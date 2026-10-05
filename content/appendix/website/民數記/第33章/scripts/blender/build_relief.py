"""地形暈渲圖：public/relief/ 底下的幾張圖，網站的旅程地圖與開場故事用。

在 Blender 開著 MCP addon（port 9876）時執行：
    python scripts/blender/send.py scripts/blender/build_relief.py

高程資料：AWS Terrain Tiles（Terrarium 編碼，第 8 級；整合 SRTM、ETOPO1 等公開資料）。
先用 scripts/fetch-dem.mjs 下載到暫存目錄（不進版控），再設 NUM33_DEM 指到那個目錄。

座標和網站的 src/geo.ts 完全一樣：等距圓柱投影，經度乘 cos(30°)，每一緯度 165 單位，
原點是地圖範圍的西北角（東經 29.5、北緯 32.4）。Blender 裡北是 +Y，所以 y = (緯度 − 32.4) × 165。
渲染範圍比地圖多一圈（四邊各一度），平移到邊緣時不會看到切邊。
"""
import math
import os

import bpy
import numpy as np

DEM = os.environ.get("NUM33_DEM") or "C:/Users/ANDYJ_~1/AppData/Local/Temp/claude/c--Obsidian-Hermes-scripture/4a9ce524-5c5a-44b7-aa12-1d8ec140880a/scratchpad/dem/z8"
OUT = os.environ.get("NUM33_OUT") or "C:/Obsidian/Hermes/scripture/appendix/website/民數記/第33章/public/relief"
SCENE = "num33_relief"
# 要渲染哪幾張、多寬（預覽時改小）
RENDERS = os.environ.get("NUM33_RENDERS", "light,dark,hero").split(",")
WIDTH = int(os.environ.get("NUM33_WIDTH", "3200"))
HERO_W = int(os.environ.get("NUM33_HERO_W", "1920"))

# 和 src/geo.ts 相同的投影
W0, N0 = 29.5, 32.4
K = math.cos(math.radians(30))
S = 165.0
# 渲染範圍：地圖範圍（29.5–36.5E、27.4–32.4N）四邊各多一度
LON0, LON1, LAT0, LAT1 = 28.5, 37.5, 26.4, 33.4
STEP = 0.0075  # 取樣間距（度），約 800 公尺
UNIT_KM = 111.0 / S  # 一個地圖單位多少公里
EXAG = 5.0  # 垂直誇張


def fresh_scene():
    old = bpy.data.scenes.get(SCENE)
    host = next(s for s in bpy.data.scenes if s.name != SCENE)
    if old:
        if bpy.context.window.scene == old:
            bpy.context.window.scene = host
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(old)
    sc = bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = sc
    return sc


def load_dem():
    """把 Terrarium 瓦片拼起來，回傳 (高程陣列, 取樣函式)。高程 = R*256 + G + B/256 − 32768（公尺）"""
    z = 8
    n = 2 ** z
    tiles = [f for f in os.listdir(DEM) if f.endswith(".png")]
    xs = sorted({int(f.split("_")[0]) for f in tiles})
    ys = sorted({int(f.split("_")[1].split(".")[0]) for f in tiles})
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), dtype=np.float32)
    for f in tiles:
        tx = int(f.split("_")[0])
        ty = int(f.split("_")[1].split(".")[0])
        img = bpy.data.images.load(os.path.join(DEM, f), check_existing=False)
        try:
            img.colorspace_settings.name = "Non-Color"
        except TypeError:
            pass
        px = np.array(img.pixels[:], dtype=np.float32).reshape(256, 256, 4)[::-1]  # Blender 的列是由下往上
        rgb = np.round(px[:, :, :3] * 255.0)
        elev = rgb[:, :, 0] * 256.0 + rgb[:, :, 1] + rgb[:, :, 2] / 256.0 - 32768.0
        r, c = (ty - ys[0]) * 256, (tx - xs[0]) * 256
        mosaic[r:r + 256, c:c + 256] = elev
        bpy.data.images.remove(img)

    def sample(lon, lat):
        gx = (lon + 180.0) / 360.0 * n * 256 - xs[0] * 256
        rl = np.radians(lat)
        gy = (1 - np.log(np.tan(rl) + 1 / np.cos(rl)) / math.pi) / 2 * n * 256 - ys[0] * 256
        x0 = np.clip(np.floor(gx).astype(int), 0, mosaic.shape[1] - 2)
        y0 = np.clip(np.floor(gy).astype(int), 0, mosaic.shape[0] - 2)
        fx, fy = gx - x0, gy - y0
        a = mosaic[y0, x0] * (1 - fx) + mosaic[y0, x0 + 1] * fx
        b = mosaic[y0 + 1, x0] * (1 - fx) + mosaic[y0 + 1, x0 + 1] * fx
        return a * (1 - fy) + b * fy

    return sample


BASEMAP = os.environ.get("NUM33_BASEMAP") or "C:/Obsidian/Hermes/scripture/appendix/website/民數記/第33章/src/data/basemap.json"


def fill_rings(rings, lons, lats):
    """多邊形掃描轉換（奇偶規則）：每一列數一數左邊穿過幾條邊，奇數就在裡面"""
    cross = np.zeros((len(lats), len(lons) + 1), dtype=np.int32)
    for ring in rings:
        pts = np.asarray(ring, dtype=np.float64)
        if not np.allclose(pts[0], pts[-1]):
            pts = np.vstack([pts, pts[:1]])
        x1, y1, x2, y2 = pts[:-1, 0], pts[:-1, 1], pts[1:, 0], pts[1:, 1]
        L = lats[None, :]
        hit = ((y1[:, None] <= L) & (L < y2[:, None])) | ((y2[:, None] <= L) & (L < y1[:, None]))
        e_idx, r_idx = np.nonzero(hit)
        t = (lats[r_idx] - y1[e_idx]) / (y2[e_idx] - y1[e_idx])
        xi = x1[e_idx] + t * (x2[e_idx] - x1[e_idx])
        c_idx = np.searchsorted(lons, xi)
        np.add.at(cross, (r_idx, c_idx), 1)
    return (np.cumsum(cross, axis=1)[:, :-1] % 2) == 1


def water_mask(lons, lats):
    """水陸用網站本來就在用的 Natural Earth 海岸線與湖泊（basemap.json），暈渲圖和向量海岸線才會吻合"""
    import json
    bm = json.load(open(BASEMAP, encoding="utf-8"))
    land = fill_rings([r for poly in bm["land"] for r in poly], lons, lats)
    lake = fill_rings([r for lk in bm["lakes"] for r in lk["rings"]], lons, lats)
    return ~land | lake


def build_mesh(sc):
    sample = load_dem()
    lons = np.arange(LON0, LON1 + 1e-9, STEP)
    lats = np.arange(LAT1, LAT0 - 1e-9, -STEP)
    LON, LAT = np.meshgrid(lons, lats)
    e = sample(LON, LAT)
    water = water_mask(lons, lats)
    # 水面壓平：海在 0，死海在它自己的水面
    ez = np.where(water & (LON > 35.3) & (LON < 35.65) & (LAT > 30.9), -405.0, np.where(water, 0.0, e))
    x = (LON - W0) * K * S
    y = (LAT - N0) * S
    zc = ez / 1000.0 / UNIT_KM * EXAG
    rows, cols = LON.shape
    verts = np.stack([x, y, zc], axis=-1).reshape(-1, 3).astype(np.float32)

    idx = np.arange(rows * cols).reshape(rows, cols)
    a = idx[:-1, :-1].ravel()
    b = idx[1:, :-1].ravel()
    c = idx[1:, 1:].ravel()
    d = idx[:-1, 1:].ravel()
    quads = np.stack([a, b, c, d], axis=-1)  # 由上往下排的列，這樣排是逆時針（法線朝上）
    me = bpy.data.meshes.new("relief")
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    me.loops.add(quads.size)
    me.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, quads.size, 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate(verbose=False)
    if hasattr(me, "shade_smooth"):
        me.shade_smooth()

    # 屬性：高程（公尺）與是否為水，給材質上色用
    elev_attr = me.attributes.new("elev", "FLOAT", "POINT")
    elev_attr.data.foreach_set("value", e.ravel().astype(np.float32))
    water_attr = me.attributes.new("water", "FLOAT", "POINT")
    water_attr.data.foreach_set("value", water.ravel().astype(np.float32))
    ob = bpy.data.objects.new("relief", me)
    sc.collection.objects.link(ob)
    print("mesh", rows, "x", cols, "verts", len(verts), "elev range", float(e.min()), float(e.max()))
    return ob



# ------------------------------------------------------------ 材質、燈光、渲染
# 沙漠色階：低處淺沙，往上赭、紅褐、花崗岩；水依深度由淺藍到深藍。彩度刻意壓低，路線的顏色才跳得出來
PALETTES = {
    # 淺色主題
    "light": ([(-450, "#cdbb94"), (0, "#e2d4b1"), (300, "#d9c49a"), (700, "#c9a979"), (1200, "#ab8461"), (1800, "#8a6b53"), (2600, "#74604f")],
              [(-1800, "#2c566e"), (-200, "#3f6f86"), (0, "#6d98ab")]),
    # 深色主題：夜裡的沙漠，地比水亮一點，山的明暗還看得出來
    "dark": ([(-450, "#3e3833"), (0, "#4a4239"), (300, "#4f463b"), (700, "#58493b"), (1200, "#5f4c3d"), (1800, "#5c4a3e"), (2600, "#56483f")],
             [(-1800, "#0d1824"), (-200, "#13243a"), (0, "#1c3149")]),
}


def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]  # 轉成線性，Blender 的顏色是線性的


def ramp_node(nodes, stops, lo, hi):
    """高程（公尺）→ 0..1 → 色階"""
    mr = nodes.new("ShaderNodeMapRange")
    mr.inputs[1].default_value = lo
    mr.inputs[2].default_value = hi
    cr = nodes.new("ShaderNodeValToRGB")
    els = cr.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    for i, (v, col) in enumerate(stops):
        el = els[0] if i == 0 else els.new((v - lo) / (hi - lo))
        el.position = (v - lo) / (hi - lo)
        el.color = (*hex_rgb(col), 1.0)
    return mr, cr


def make_material(kind):
    mat = bpy.data.materials.new(f"relief_{kind}")
    land_stops, water_stops = PALETTES.get(kind, PALETTES["light"])
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    spec = bsdf.inputs.get("Specular IOR Level") or bsdf.inputs.get("Specular")
    if spec:
        spec.default_value = 0.0
    if kind == "shade":
        bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
        return mat
    elev = nodes.new("ShaderNodeAttribute")
    elev.attribute_name = "elev"
    water = nodes.new("ShaderNodeAttribute")
    water.attribute_name = "water"
    mr1, land = ramp_node(nodes, land_stops, -450, 2600)
    mr2, sea = ramp_node(nodes, water_stops, -1800, 0)
    links.new(elev.outputs["Fac"], mr1.inputs[0])
    links.new(elev.outputs["Fac"], mr2.inputs[0])
    links.new(mr1.outputs[0], land.inputs[0])
    links.new(mr2.outputs[0], sea.inputs[0])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    links.new(water.outputs["Fac"], mix.inputs["Factor"])
    links.new(land.outputs["Color"], mix.inputs[6])
    links.new(sea.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return mat


def setup_render(sc, w, h, samples=32):
    try:
        sc.render.engine = "CYCLES"
    except TypeError as e:
        print("engine", e)
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    fmts = [i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties["file_format"].enum_items]
    sc.render.image_settings.file_format = "WEBP" if "WEBP" in fmts else "PNG"
    if sc.render.image_settings.file_format == "WEBP":
        sc.render.image_settings.quality = 82
    sc.render.image_settings.color_mode = "RGB"
    world = bpy.data.worlds.new("relief_world")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.55, 0.6, 0.7, 1)
    bg.inputs["Strength"].default_value = 0.35
    sc.world = world


def sun(sc, az_deg, el_deg, strength, angle=4.0):
    """az：光從哪個方位來（0 北、90 東、270 西、315 西北）；el：仰角"""
    data = bpy.data.lights.new("relief_sun", "SUN")
    data.energy = strength
    data.angle = math.radians(angle)
    ob = bpy.data.objects.new("relief_sun", data)
    sc.collection.objects.link(ob)
    az, el = math.radians(az_deg), math.radians(el_deg)
    d = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))  # 指向光源
    ob.rotation_euler = (0, 0, 0)
    import mathutils
    ob.rotation_euler = mathutils.Vector(d).to_track_quat("Z", "Y").to_euler()
    return ob


def top_camera(sc, relief):
    bb = [relief.matrix_world @ __import__("mathutils").Vector(c) for c in relief.bound_box]
    x0, x1 = min(v.x for v in bb), max(v.x for v in bb)
    y0, y1 = min(v.y for v in bb), max(v.y for v in bb)
    cam = bpy.data.cameras.new("relief_top")
    cam.type = "ORTHO"
    cam.ortho_scale = max(x1 - x0, y1 - y0)
    cam.clip_end = 2000
    ob = bpy.data.objects.new("relief_top", cam)
    sc.collection.objects.link(ob)
    ob.location = ((x0 + x1) / 2, (y0 + y1) / 2, 500)
    ob.rotation_euler = (0, 0, 0)
    sc.camera = ob
    return (x0, x1, y0, y1)


def render(sc, name):
    os.makedirs(OUT, exist_ok=True)
    ext = ".webp" if sc.render.image_settings.file_format == "WEBP" else ".png"
    sc.render.filepath = os.path.join(OUT, name + ext)
    bpy.ops.render.render(write_still=True, scene=sc.name)
    print("rendered", sc.render.filepath, os.path.getsize(sc.render.filepath))


def hero_shot(sc, relief, light):
    """開場斜視圖：從紅海上空往北看西奈半島，夕陽從西邊斜照。垂直再誇張 1.6 倍（總共約 8 倍，只用在這張圖）；
    俯角夠大，畫面上看不到地平線，也就看不到地形網格的邊。"""
    import mathutils
    relief.data.materials.clear()
    relief.data.materials.append(make_material("light"))
    relief.scale.z = 1.6
    az, el = math.radians(258), math.radians(11)
    d = mathutils.Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    light.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    light.data.energy = 5.0
    cam = bpy.data.cameras.new("relief_hero")
    cam.lens = 30
    cam.clip_end = 5000
    ob = bpy.data.objects.new("relief_hero", cam)
    sc.collection.objects.link(ob)
    target = mathutils.Vector((640, -580, 0))
    ob.location = (590, -1000, 440)
    ob.rotation_euler = (target - ob.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = ob
    sc.render.resolution_x = HERO_W
    sc.render.resolution_y = round(HERO_W * 9 / 16)
    render(sc, "relief-hero")
    relief.scale.z = 1.0


# ------------------------------------------------------------ 執行
sc = fresh_scene()
relief = build_mesh(sc)
x0, x1, y0, y1 = top_camera(sc, relief)
setup_render(sc, WIDTH, round(WIDTH * (y1 - y0) / (x1 - x0)))
light = sun(sc, 315, 32, 4.2)  # 製圖慣例：光從西北方來
for kind in ("light", "dark"):
    if kind in RENDERS:
        relief.data.materials.clear()
        relief.data.materials.append(make_material(kind))
        render(sc, f"relief-{kind}")
if "hero" in RENDERS:
    hero_shot(sc, relief, light)
print("bounds", x0, x1, y0, y1)
