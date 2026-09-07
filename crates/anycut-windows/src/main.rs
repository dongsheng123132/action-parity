//! Windows-only observation helper. It performs no UI interaction and never writes raw frames to disk.
use serde::Serialize;
use serde_json::{json, Value};
use std::ffi::c_void;
use std::io::{self, BufRead, Write};

type Hwnd = isize;
type Hdc = isize;
type Hbitmap = isize;

#[repr(C)] #[derive(Clone, Copy)]
struct Rect { left: i32, top: i32, right: i32, bottom: i32 }
#[repr(C)]
struct BitmapInfoHeader { bi_size: u32, bi_width: i32, bi_height: i32, bi_planes: u16, bi_bit_count: u16, bi_compression: u32, bi_size_image: u32, bi_x_pels_per_meter: i32, bi_y_pels_per_meter: i32, bi_clr_used: u32, bi_clr_important: u32 }
#[repr(C)]
struct BitmapInfo { header: BitmapInfoHeader, colors: [u32; 1] }

#[link(name = "user32")]
extern "system" {
    fn EnumWindows(callback: Option<unsafe extern "system" fn(Hwnd, isize) -> i32>, lparam: isize) -> i32;
    fn IsWindowVisible(hwnd: Hwnd) -> i32;
    fn GetWindowTextLengthW(hwnd: Hwnd) -> i32;
    fn GetWindowTextW(hwnd: Hwnd, text: *mut u16, max_count: i32) -> i32;
    fn GetWindowThreadProcessId(hwnd: Hwnd, process_id: *mut u32) -> u32;
    fn GetWindowRect(hwnd: Hwnd, rect: *mut Rect) -> i32;
    fn GetDpiForWindow(hwnd: Hwnd) -> u32;
    fn GetWindowDC(hwnd: Hwnd) -> Hdc;
    fn ReleaseDC(hwnd: Hwnd, hdc: Hdc) -> i32;
    fn PrintWindow(hwnd: Hwnd, hdc: Hdc, flags: u32) -> i32;
}
#[link(name = "gdi32")]
extern "system" {
    fn CreateCompatibleDC(hdc: Hdc) -> Hdc;
    fn CreateDIBSection(hdc: Hdc, info: *const BitmapInfo, usage: u32, bits: *mut *mut c_void, section: isize, offset: u32) -> Hbitmap;
    fn SelectObject(hdc: Hdc, object: isize) -> isize;
    fn DeleteObject(object: isize) -> i32;
    fn DeleteDC(hdc: Hdc) -> i32;
}

#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> isize;
    fn CloseHandle(handle: isize) -> i32;
    fn K32GetModuleFileNameExW(process: isize, module: isize, text: *mut u16, size: u32) -> u32;
}
const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

#[derive(Serialize)]
struct WindowInfo { hwnd: String, pid: u32, title: String, bounds_px: Bounds, dpi: u32, image_name: String, image_path: String }
#[derive(Serialize)]
struct Bounds { x: i32, y: i32, width: i32, height: i32 }

unsafe fn title(hwnd: Hwnd) -> String {
    let length = GetWindowTextLengthW(hwnd);
    if length <= 0 { return String::new(); }
    let mut wide = vec![0u16; length as usize + 1];
    let count = GetWindowTextW(hwnd, wide.as_mut_ptr(), wide.len() as i32);
    String::from_utf16(&wide[..count.max(0) as usize]).unwrap_or_else(|_| String::new())
}
unsafe fn process_image_path(pid: u32) -> String {
    let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if process == 0 { return String::new(); }
    let mut wide = [0u16; 1024];
    let count = K32GetModuleFileNameExW(process, 0, wide.as_mut_ptr(), wide.len() as u32);
    CloseHandle(process);
    String::from_utf16_lossy(&wide[..count.max(0) as usize])
}

unsafe fn info(hwnd: Hwnd) -> Option<WindowInfo> {
    if IsWindowVisible(hwnd) == 0 { return None; }
    let text = title(hwnd);
    if text.is_empty() { return None; }
    let mut pid = 0;
    GetWindowThreadProcessId(hwnd, &mut pid);
    if pid == 0 { return None; }
    let mut rect = Rect { left: 0, top: 0, right: 0, bottom: 0 };
    if GetWindowRect(hwnd, &mut rect) == 0 { return None; }
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;
    if width <= 0 || height <= 0 { return None; }
    let image_path = process_image_path(pid);
    let image_name = std::path::Path::new(&image_path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "unknown.exe".into());
    Some(WindowInfo { hwnd: format!("0x{:X}", hwnd as usize), pid, title: text, bounds_px: Bounds { x: rect.left, y: rect.top, width, height }, dpi: GetDpiForWindow(hwnd), image_name, image_path })
}
unsafe extern "system" fn collect_windows(hwnd: Hwnd, lparam: isize) -> i32 {
    let entries = &mut *(lparam as *mut Vec<WindowInfo>);
    if let Some(entry) = info(hwnd) { entries.push(entry); }
    1
}
fn enumerate(filter: &str) -> Vec<WindowInfo> {
    let mut result = Vec::new();
    unsafe { EnumWindows(Some(collect_windows), &mut result as *mut _ as isize); }
    result.into_iter().filter(|item: &WindowInfo| filter.is_empty() || item.title.contains(filter)).collect()
}

fn crc32(bytes: &[u8]) -> u32 { let mut crc = !0u32; for byte in bytes { crc ^= *byte as u32; for _ in 0..8 { crc = if crc & 1 != 0 { (crc >> 1) ^ 0xedb88320 } else { crc >> 1 }; } } !crc }
fn adler32(bytes: &[u8]) -> u32 { let (mut a, mut b) = (1u32, 0u32); for byte in bytes { a = (a + *byte as u32) % 65521; b = (b + a) % 65521; } (b << 16) | a }
fn png_chunk(output: &mut Vec<u8>, kind: &[u8; 4], value: &[u8]) { output.extend_from_slice(&(value.len() as u32).to_be_bytes()); output.extend_from_slice(kind); output.extend_from_slice(value); output.extend_from_slice(&crc32(&[kind.as_slice(), value].concat()).to_be_bytes()); }
fn png_bgra(width: usize, height: usize, pixels: &[u8]) -> Vec<u8> {
    let mut raw = Vec::with_capacity(height * (width * 4 + 1));
    for y in (0..height).rev() { raw.push(0); for x in 0..width { let i = (y * width + x) * 4; raw.extend_from_slice(&[pixels[i + 2], pixels[i + 1], pixels[i], 255]); } }
    let mut compressed = vec![0x78, 0x01];
    for (index, part) in raw.chunks(65535).enumerate() { compressed.push(if (index + 1) * 65535 >= raw.len() { 1 } else { 0 }); compressed.extend_from_slice(&(part.len() as u16).to_le_bytes()); compressed.extend_from_slice(&(!(part.len() as u16)).to_le_bytes()); compressed.extend_from_slice(part); }
    compressed.extend_from_slice(&adler32(&raw).to_be_bytes());
    let mut output = vec![137, 80, 78, 71, 13, 10, 26, 10]; let mut header = Vec::new(); header.extend_from_slice(&(width as u32).to_be_bytes()); header.extend_from_slice(&(height as u32).to_be_bytes()); header.extend_from_slice(&[8, 6, 0, 0, 0]); png_chunk(&mut output, b"IHDR", &header); png_chunk(&mut output, b"IDAT", &compressed); png_chunk(&mut output, b"IEND", &[]); output
}
fn capture(hwnd: Hwnd) -> Result<(Vec<u8>, WindowInfo), String> {
    let item = unsafe { info(hwnd) }.ok_or_else(|| "window_not_found".to_string())?;
    let (width, height) = (item.bounds_px.width as usize, item.bounds_px.height as usize);
    if width > 32768 || height > 32768 || width.saturating_mul(height) > 67_108_864 { return Err("capture_too_large".into()); }
    unsafe {
        let source = GetWindowDC(hwnd); if source == 0 { return Err("window_dc_failed".into()); }
        let memory = CreateCompatibleDC(source); if memory == 0 { ReleaseDC(hwnd, source); return Err("memory_dc_failed".into()); }
        let info = BitmapInfo { header: BitmapInfoHeader { bi_size: std::mem::size_of::<BitmapInfoHeader>() as u32, bi_width: width as i32, bi_height: height as i32, bi_planes: 1, bi_bit_count: 32, bi_compression: 0, bi_size_image: 0, bi_x_pels_per_meter: 0, bi_y_pels_per_meter: 0, bi_clr_used: 0, bi_clr_important: 0 }, colors: [0] };
        let mut bits: *mut c_void = std::ptr::null_mut(); let bitmap = CreateDIBSection(source, &info, 0, &mut bits, 0, 0);
        if bitmap == 0 || bits.is_null() { if bitmap != 0 { DeleteObject(bitmap); } DeleteDC(memory); ReleaseDC(hwnd, source); return Err("dib_failed".into()); }
        let old = SelectObject(memory, bitmap); let printed = PrintWindow(hwnd, memory, 2 /* PW_RENDERFULLCONTENT: GPU 合成内容（WebView2/Electron）需此标志，否则客户区黑屏 */); let bytes = if printed == 0 { Err("printwindow_failed".into()) } else { let raw = std::slice::from_raw_parts(bits as *const u8, width * height * 4); Ok(png_bgra(width, height, raw)) };
        SelectObject(memory, old); DeleteObject(bitmap); DeleteDC(memory); ReleaseDC(hwnd, source); bytes.map(|png| (png, item))
    }
}
fn respond(control: Value, frame: Option<Vec<u8>>) { let mut stdout = io::stdout().lock(); let _ = serde_json::to_writer(&mut stdout, &control); let _ = stdout.write_all(b"\n"); if let Some(bytes) = frame { let _ = stdout.write_all(&bytes); } let _ = stdout.flush(); }
fn parse_hwnd(value: &str) -> Option<Hwnd> { usize::from_str_radix(value.trim_start_matches("0x"), 16).ok().map(|n| n as Hwnd) }
fn main() {
    let mut input = String::new(); if io::stdin().lock().read_line(&mut input).is_err() || input.len() > 65536 { respond(json!({"ok":false,"code":"invalid_control"}), None); return; }
    let request: Value = match serde_json::from_str(&input) { Ok(v) => v, Err(_) => { respond(json!({"ok":false,"code":"invalid_json"}), None); return; } };
    match request.get("op").and_then(Value::as_str) {
        Some("list") => { let filter = request.get("filter").and_then(Value::as_str).unwrap_or(""); respond(json!({"ok":true,"op":"list","windows":enumerate(filter),"known_limitations":["UIA tree pending R2"]}), None); }
        Some("capture") => match request.get("hwnd").and_then(Value::as_str).and_then(parse_hwnd).and_then(|hwnd| capture(hwnd).ok()) { Some((png, window)) => respond(json!({"ok":true,"op":"capture","frame_bytes":png.len(),"window":window,"known_limitations":["UIA tree pending R2"]}), Some(png)), None => respond(json!({"ok":false,"code":"capture_failed"}), None) },
        _ => respond(json!({"ok":false,"code":"unknown_op"}), None)
    }
}
