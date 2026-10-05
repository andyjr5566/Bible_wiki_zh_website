"""曠野地形與帳棚模型：public/models/terrain.glb、tent.glb。

在 Blender 開著 MCP addon（port 9876）時執行：
    python scripts/blender/send.py scripts/blender/build_wilderness.py

座標：Blender 是 Z 朝上、北是 +Y；glTF 匯出後是 Y 朝上、北是 −Z，和網站的 three.js 場景一致
（東 +x）。單位和網站的場景單位相同（地圖像素 × 0.9），不是公尺。

地形全是示意：經文沒有記營地的地形。遠山一圈、往東留一道山口讓行列朝日出的方向走
（行進方向本身也是示意），南邊一座最高的山塊，東北邊一座營外的高處（民23:28、24:2 的鏡頭用，
位置與高度都是示意，和 src/three/scene.ts 的 balaam 鏡頭對齊）。
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector, noise

# send.py 把整份程式碼送進 Blender 執行，沒有 __file__，所以輸出位置寫死（可用環境變數覆寫）
OUT = os.environ.get("NUM2_OUT") or "C:/Obsidian/Hermes/scripture/appendix/website/民數記/第2章/public/models"
SCENE = "num2_wilderness"


def fresh_scene():
    # 在自己的場景裡建，不動使用者開著的其他東西；重跑時刪掉自己上次建的
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


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mix(c1, c2, t):
    return tuple(c1[i] + (c2[i] - c1[i]) * t for i in range(3))


HILL = (668.0, 382.0)  # three.js (668, ?, −382)
SINAI = (-700.0, -2650.0)  # 南邊（three.js +z）的大山塊
SAND = (0.86, 0.78, 0.60)
SAND_DARK = (0.78, 0.68, 0.50)
OCHRE = (0.70, 0.49, 0.33)
GRANITE = (0.42, 0.32, 0.27)
GRANITE_HI = (0.52, 0.40, 0.33)


def height(x, y):
    r = math.hypot(x, y)
    p = Vector((x / 1500.0, y / 1500.0, 0.37))
    # 平坦的營地，只有很淡的起伏
    h = 2.2 * noise.noise(Vector((x / 260.0, y / 260.0, 1.3)))
    # 遠山：脊狀分形
    ridge = noise.ridged_multi_fractal(p, 0.9, 2.1, 5, 1.0, 2.0)
    m = smooth(1250.0, 2400.0, r)
    mount = m * (180.0 + 300.0 * max(0.0, ridge - 0.25))
    # 往東的山口
    if x > 0:
        corridor = 1.0 - smooth(170.0, 560.0, abs(y))
        mount *= 1.0 - 0.88 * corridor * smooth(600.0, 1600.0, x)
    # 南邊的大山塊
    d = math.hypot(x - SINAI[0], y - SINAI[1])
    mount += 760.0 * math.exp(-(d * d) / (2 * 620.0 ** 2)) * (0.75 + 0.35 * ridge)
    h += mount
    # 營外的高處：平頂、四面陡的小山
    dh = math.hypot(x - HILL[0], y - HILL[1])
    k = smooth(235.0, 70.0, dh + 18.0 * noise.noise(Vector((x / 60.0, y / 60.0, 4.0))))
    h += 142.0 * k * (0.92 + 0.08 * noise.noise(Vector((x / 40.0, y / 40.0, 7.0))))
    # 營地中央略低於網站的地面圓盤（半徑 1500、y=0），讓圓盤的沙紋蓋住；往外才由地形接手
    h -= 3.5 * (1.0 - smooth(1250.0, 1650.0, r))
    # 地形邊緣往下，接到地面圓盤底下
    h -= 60.0 * smooth(4150.0, 4400.0, r)
    return h


def build_terrain(sc):
    radii = [0, 160, 320, 480]
    radii += [480 + 40 * i for i in range(1, 17)]  # 到 1120：營外高處那一圈比較密
    r = radii[-1]
    while r < 4400:
        r += 70 if r < 2600 else 95
        radii.append(min(r, 4400))
    seg = 144
    bm = bmesh.new()
    rings = []
    center = bm.verts.new((0, 0, height(0, 0)))
    for rad in radii[1:]:
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg + (0.5 * 2 * math.pi / seg if len(rings) % 2 else 0)
            x, y = rad * math.cos(a), rad * math.sin(a)
            ring.append(bm.verts.new((x, y, height(x, y))))
        rings.append(ring)
    for j in range(seg):
        bm.faces.new((center, rings[0][j], rings[0][(j + 1) % seg]))
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(seg):
            bm.faces.new((a[j], b[j], b[(j + 1) % seg], a[(j + 1) % seg]))
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("terrain")
    bm.to_mesh(me)
    bm.free()

    # 頂點色：低處沙、高處赭紅岩、陡坡深色花崗岩
    me.calc_normals_split() if hasattr(me, "calc_normals_split") else None
    col = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    vnorm = [v.normal.copy() for v in me.vertices]
    for v in me.vertices:
        x, y, z = v.co
        slope = 1.0 - max(0.0, vnorm[v.index].z)
        jitter = 0.5 + 0.5 * noise.noise(Vector((x / 90.0, y / 90.0, 2.0)))
        c = mix(SAND, SAND_DARK, jitter * 0.6)
        c = mix(c, OCHRE, smooth(25.0, 140.0, z) * 0.85)
        c = mix(c, GRANITE, smooth(0.25, 0.6, slope) * smooth(30.0, 160.0, z))
        c = mix(c, GRANITE_HI, smooth(420.0, 900.0, z) * 0.6)
        col.data[v.index].color = (*c, 1.0)
    me.color_attributes.active_color = col
    ob = bpy.data.objects.new("terrain", me)
    sc.collection.objects.link(ob)
    return ob


def build_tent(sc):
    """帳棚：中間一根高竿把頂撐起、四角低竿、四面斜頂，前面的門簾掀開一角。

    尺寸配合網站的排法（橫 9、縱 12.5 一格），寬 8.4、深 7.2、高 5；門朝 +y（glTF 的 −z 會再由網站
    轉向會幕）。頂點色只用來分明暗：門洞最暗、頂面亮、側牆暗一點；營的顏色由網站的 instance color 染。
    """
    W, D, H, wall = 4.2, 3.6, 4.6, 1.1
    bm = bmesh.new()
    cols = []

    def face(pts, k):
        f = bm.faces.new([bm.verts.new(p) for p in pts])
        cols.append((f, k))

    # 屋脊：前後兩根竿把脊撐起，中間略為下垂
    ridge_f = (0, D * 0.78, H)
    ridge_b = (0, -D * 0.78, H)
    sag = (0, 0, H - 0.85)
    eF_L, eF_R = (-W, D, wall), (W, D, wall)
    eB_L, eB_R = (-W, -D, wall), (W, -D, wall)
    # 左右兩片屋頂（各拆成兩片才有下垂）
    face([eB_L, eF_L, ridge_f, sag], 1.0)
    face([eB_L, sag, ridge_b], 1.0)
    face([eF_R, eB_R, ridge_b, sag], 0.9)
    face([eF_R, sag, ridge_f], 0.9)
    # 前後兩片斜頂
    face([eF_L, eF_R, ridge_f], 0.82)
    face([eB_R, eB_L, ridge_b], 0.78)
    # 四面矮牆
    g = 0.0
    face([(-W, D, g), (W, D, g), eF_R, eF_L], 0.62)
    face([(W, -D, g), (-W, -D, g), eB_L, eB_R], 0.6)
    face([(-W, -D, g), (-W, D, g), eF_L, eB_L], 0.66)
    face([(W, D, g), (W, -D, g), eB_R, eF_R], 0.66)
    # 門洞與掀開的門簾
    e = D + 0.04
    face([(-1.2, e, 0), (1.2, e, 0), (1.0, e, wall + 0.9), (-1.0, e, wall + 0.9)], 0.08)
    face([(1.2, e, 0), (2.6, D + 1.3, 0.25), (2.3, D + 1.0, wall + 0.6), (1.0, e, wall + 0.9)], 0.7)

    me = bpy.data.meshes.new("tent")
    bm.to_mesh(me)
    bm.free()
    col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    # bmesh 轉 mesh 後面的順序不變：照建立的順序上色
    for poly, (_, k) in zip(me.polygons, cols):
        for li in poly.loop_indices:
            col.data[li].color = (k, k, k, 1.0)
    me.color_attributes.active_color = col
    ob = bpy.data.objects.new("tent", me)
    sc.collection.objects.link(ob)
    return ob


def export(ob, name, normals):
    for o in bpy.context.scene.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    path = os.path.normpath(os.path.join(OUT, f"{name}.glb"))
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, use_active_scene=True,
        export_yup=True, export_normals=normals, export_texcoords=False,
        export_vertex_color="ACTIVE", export_active_vertex_color_when_no_material=True,
        export_materials="NONE", export_apply=True,
    )
    print(name, os.path.getsize(path), "bytes", len(ob.data.vertices), "verts", len(ob.data.polygons), "faces")


sc = fresh_scene()
terrain = build_terrain(sc)
tent = build_tent(sc)
tent.location.x = 900  # 在 Blender 裡看的時候不要疊在地形上；匯出前歸零
export(terrain, "terrain", normals=False)
tent.location.x = 0
export(tent, "tent", normals=True)
tent.location.x = 900
