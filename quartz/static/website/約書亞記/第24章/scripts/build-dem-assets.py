"""
從 collect/dem/ 產出前端直接內嵌的真實高程與暈渲資源：
1. src/assets/dem/shechem-dem.json — 示劍山谷（以巴路山—示劍隘口—基利心山）5200m × 4600m 雙線性網格
2. src/assets/dem/wide-relief.webp — 記憶地圖（28.5..48.0 E, 26.5..38.5 N）Mercator 逆投影等經緯暈渲圖
不連網，只讀 collect/dem/。
"""

from __future__ import annotations
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEM_DIR = ROOT / "collect" / "dem"
OUT_DIR = ROOT / "src" / "assets" / "dem"


def lonlat_to_mercator_px(
    lon: np.ndarray | float,
    lat: np.ndarray | float,
    zoom: int,
    origin_x: float,
    origin_y: float,
):
    n = 256.0 * (2 ** zoom)
    lat_rad = np.deg2rad(lat)
    s = np.sin(lat_rad)
    px = (lon + 180.0) / 360.0 * n - origin_x
    py = (0.5 - np.log((1.0 + s) / (1.0 - s)) / (4.0 * math.pi)) * n - origin_y
    return px, py


def bilinear_sample(arr: np.ndarray, px: np.ndarray, py: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    px_c = np.clip(px, 0.0, w - 1.0001)
    py_c = np.clip(py, 0.0, h - 1.0001)
    x0 = np.floor(px_c).astype(np.int32)
    y0 = np.floor(py_c).astype(np.int32)
    fx = px_c - x0
    fy = py_c - y0
    v00 = arr[y0, x0]
    v10 = arr[y0, x0 + 1]
    v01 = arr[y0 + 1, x0]
    v11 = arr[y0 + 1, x0 + 1]
    if arr.ndim == 3:
        fx = fx[..., None]
        fy = fy[..., None]
    return (v00 * (1.0 - fx) + v10 * fx) * (1.0 - fy) + (v01 * (1.0 - fx) + v11 * fx) * fy


def build_shechem_grid() -> None:
    meta = json.loads((DEM_DIR / "shechem_valley_meta.json").read_text(encoding="utf-8"))
    img = Image.open(DEM_DIR / "shechem_valley_height.png")
    elev_m = np.array(img, dtype=np.float32) - float(meta["elevation_offset"])

    zoom = int(meta["zoom"])
    ox = float(meta["origin_world_px"]["origin_x"])
    oy = float(meta["origin_world_px"]["origin_y"])

    # 以示劍隘口（Tell Balata 35.288E 與兩山鞍部 35.275E 之間：35.2815°E, 32.2145°N）為 (0, 0)
    center_lon = 35.2815
    center_lat = 32.2145
    m_per_deg_lat = 110890.0
    m_per_deg_lon = 111320.0 * math.cos(math.radians(center_lat))

    width_m = 5200.0
    depth_m = 4600.0
    cols = 145
    rows = 129

    xs = np.linspace(-width_m * 0.5, width_m * 0.5, cols, dtype=np.float64)
    # three.js 世界座標：+X 東、-Z 北（以巴路山）、+Z 南（基利心山）
    zs = np.linspace(-depth_m * 0.5, depth_m * 0.5, rows, dtype=np.float64)
    grid_x, grid_z = np.meshgrid(xs, zs)

    lons = center_lon + grid_x / m_per_deg_lon
    lats = center_lat - grid_z / m_per_deg_lat

    px, py = lonlat_to_mercator_px(lons, lats, zoom, ox, oy)
    sampled = bilinear_sample(elev_m, px, py)

    # 中心谷底基準高度
    c_px, c_py = lonlat_to_mercator_px(center_lon, center_lat, zoom, ox, oy)
    base_elev = float(bilinear_sample(elev_m, np.array([[c_px]]), np.array([[c_py]]))[0, 0])

    # 以 0.1 公尺整數（公寸）儲存相對高程，兼顧精度與 JSON 體積
    rel_dm = np.round((sampled - base_elev) * 10.0).astype(np.int32)

    north_peak = float(np.max(sampled[: rows // 2, :]))
    south_peak = float(np.max(sampled[rows // 2 :, :]))
    print(
        f"[shechem-dem] center={base_elev:.1f}m, Ebal(N) max={north_peak:.1f}m (+{north_peak - base_elev:.1f}m), "
        f"Gerizim(S) max={south_peak:.1f}m (+{south_peak - base_elev:.1f}m)"
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "cols": cols,
        "rows": rows,
        "widthM": width_m,
        "depthM": depth_m,
        "centerLon": center_lon,
        "centerLat": center_lat,
        "baseElevM": round(base_elev, 2),
        "relDecimeters": rel_dm.flatten().tolist(),
    }
    out_path = OUT_DIR / "shechem-dem.json"
    out_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"[shechem-dem] wrote {out_path.name} ({out_path.stat().st_size / 1024:.1f} KB)")


def build_wide_relief() -> None:
    meta = json.loads((DEM_DIR / "wide_meta.json").read_text(encoding="utf-8"))
    hs_img = Image.open(DEM_DIR / "wide_hillshade.png").convert("L")
    ht_img = Image.open(DEM_DIR / "wide_height.png")

    hs = np.array(hs_img, dtype=np.float32) / 255.0
    elev = np.array(ht_img, dtype=np.float32) - float(meta["elevation_offset"])

    zoom = int(meta["zoom"])
    ox = float(meta["origin_world_px"]["origin_x"])
    oy = float(meta["origin_world_px"]["origin_y"])

    # 對齊 geo.json wide.bbox: w=28.5, e=48.0, s=26.5, n=38.5
    out_w = 1360
    out_h = 840
    lons = np.linspace(28.5, 48.0, out_w, dtype=np.float64)
    lats = np.linspace(38.5, 26.5, out_h, dtype=np.float64)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    px, py = lonlat_to_mercator_px(lon_grid, lat_grid, zoom, ox, oy)
    hs_reproj = bilinear_sample(hs, px, py)
    el_reproj = bilinear_sample(elev, px, py)

    # 將暈渲轉換為適合羊皮紙 multiply 疊加的暖棕灰階：平地接近純白(248)，山脊陰影沉入暖褐(115)
    # 並對高山(+1500m)與約旦裂谷負高程略作色階強化
    shade = np.clip((hs_reproj - 0.70) * 1.65 + 0.92, 0.42, 1.0)
    hypso = np.clip(el_reproj / 2800.0, 0.0, 1.0) * 0.12

    r = np.clip((shade - hypso * 0.35) * 255.0, 95, 252).astype(np.uint8)
    g = np.clip((shade - hypso * 0.55) * 248.0, 86, 248).astype(np.uint8)
    b = np.clip((shade - hypso * 0.80) * 236.0, 72, 242).astype(np.uint8)

    rgb = np.stack([r, g, b], axis=-1)
    out_img = Image.fromarray(rgb, mode="RGB")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "wide-relief.jpg"
    out_img.save(out_path, format="JPEG", quality=82, optimize=True)
    print(f"[wide-relief] wrote {out_path.name} ({out_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build_shechem_grid()
    build_wide_relief()
