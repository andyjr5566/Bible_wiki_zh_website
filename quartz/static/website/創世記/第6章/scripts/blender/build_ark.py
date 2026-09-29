"""Build the ark used by the site and export it as GLB.

Run inside Blender through the MCP socket:  python send.py build_ark.py
Units are metres; 1 cubit = 0.45 m (the figure the Genesis 6 chapter file records
from 啟導本).  Blender +X runs bow→stern along the length, +Z is up, and the side
door opens toward +Y (three.js −Z after the Y-up export).

Scripture-given (創6:14-16, 8:6, 8:13):
  300 × 50 × 30 cubits overall; rooms (קִנִּים); pitch inside and out;
  a light-opening (צֹהַר) finished to one cubit above; a door in the side;
  lower, second and third decks; a window Noah opened; a covering he removed.
Everything else — hull lines, bilge radius, frames, roof form, interior layout,
ladders, pens — is an illustrative reconstruction and the site labels it so.
The whole model, roof ridge included, stays inside the 135 × 22.5 × 13.5 m box.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT = os.environ.get("ARK_OUT") or r"C:\Obsidian\Hermes\scripture\appendix\website\創世記\第6章\public\models\ark.glb"

CUBIT = 0.45
L, B, H = 300 * CUBIT, 50 * CUBIT, 30 * CUBIT          # 135, 22.5, 13.5
HALF_L, HALF_B = L / 2, B / 2
TSOHAR = 1 * CUBIT                                     # 創6:16 高一肘

# ---------------------------------------------------------------- own scene
# Build in a scene of our own so whatever else is open in Blender is left alone.
SCN_NAME = os.environ.get("ARK_SCENE") or "ark_build"
old = bpy.data.scenes.get(SCN_NAME)
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
SCN = bpy.data.scenes.new(SCN_NAME)
bpy.context.window.scene = SCN
for block in (bpy.data.meshes, bpy.data.materials):
    for item in list(block):
        if item.users == 0:
            block.remove(item)


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def mat(name, color, rough=0.8, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = m.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in m.node_tree.nodes if n.type == "OUTPUT_MATERIAL"), None) or m.node_tree.nodes.new("ShaderNodeOutputMaterial")
        m.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*srgb(color), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    return m


# Material names are the contract with src/three/ark.ts, which swaps in its own
# procedural wood textures by name.
M = {
    "hull": mat("hull_planks", "#8a6236"),
    "frame": mat("frame_timber", "#6e4a28"),
    "deck": mat("deck_planks", "#9a7446"),
    "roof": mat("roof_planks", "#7c5a36"),
    "trim": mat("trim_timber", "#5a3b1f"),
    "straw": mat("straw", "#b89a52", 0.95),
    "clay": mat("clay", "#a8623e", 0.75),
    "cloth": mat("cloth", "#b8a88a", 0.95),
    "rope": mat("rope", "#7a6242", 0.95),
    "dark": mat("dark_wood", "#3a2616"),
}


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- hull lines
def beam_at(s):
    a = abs(s)
    if a <= 0.58:
        return 1.0
    t = (a - 0.58) / 0.42
    return 1 - 0.5 * t ** 1.7


def keel_at(s):
    """Bottom of the hull (m): flat amidships, rising toward the ends."""
    return 1.9 * smoothstep(0.45, 1.0, abs(s)) ** 1.6


def side_top(s):
    """Gunwale height: a gentle sheer, lowest amidships."""
    return 11.25 + 0.55 * abs(s) ** 2


ROOF_TOP = H - TSOHAR - 0.36       # where the roof slopes stop under the gap
CAP_BOT = ROOF_TOP + TSOHAR        # ridge cap sits one cubit above → the tsohar
CAP_HALF = 1.7


def half_section(s, n_side=10, n_arc=9, n_bot=6):
    """(y, z) outline, gunwale → bilge → keel centreline, with running arc length."""
    w = HALF_B * beam_at(s)
    z0, z1 = keel_at(s), side_top(s)
    r = min(w * 0.42, (z1 - z0) * 0.3)
    pts = []
    for i in range(n_side):
        t = i / (n_side - 1)
        pts.append((w, z1 + (z0 + r - z1) * t))
    for i in range(1, n_arc + 1):
        a = i / n_arc * math.pi / 2
        pts.append((w - r + math.cos(a) * r, z0 + r - math.sin(a) * r))
    for i in range(1, n_bot + 1):
        t = i / n_bot
        pts.append(((w - r) * (1 - t), z0))
    arc = [0.0]
    for i in range(1, len(pts)):
        arc.append(arc[-1] + math.dist(pts[i - 1], pts[i]))
    return pts, arc


def point_at_arc(pts, arc, d):
    d = max(0.0, min(arc[-1], d))
    for i in range(1, len(arc)):
        if arc[i] >= d:
            t = (d - arc[i - 1]) / max(1e-9, arc[i] - arc[i - 1])
            (y0, z0), (y1, z1) = pts[i - 1], pts[i]
            return y0 + (y1 - y0) * t, z0 + (z1 - z0) * t
    return pts[-1]


def outward_normal(pts, arc, d):
    a = point_at_arc(pts, arc, d - 0.05)
    b = point_at_arc(pts, arc, d + 0.05)
    dy, dz = b[0] - a[0], b[1] - a[1]
    n = (-dz, dy)          # the outline runs top → keel, so outward is (−dz, dy)
    l = math.hypot(*n) or 1
    return n[0] / l, n[1] / l


def half_width_at(s, z):
    """Inner half-width of the hull at height z (for decks)."""
    pts, _ = half_section(s)
    for i in range(1, len(pts)):
        (y0, z0), (y1, z1) = pts[i - 1], pts[i]
        if (z0 - z) * (z1 - z) <= 0 and z0 != z1:
            t = (z - z0) / (z1 - z0)
            return y0 + (y1 - y0) * t
    return 0.0


NS = 96
STATIONS = [-1 + 2 * i / (NS - 1) for i in range(NS)]


# ---------------------------------------------------------------- bmesh helpers
class Part:
    """One exported object; many pieces are merged into it."""

    def __init__(self, name, material):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.material = material

    def quad_strip(self, rows, uvs, flip=False):
        vs = [[self.bm.verts.new(p) for p in row] for row in rows]
        for a in range(len(rows) - 1):
            for b in range(len(rows[0]) - 1):
                q = [vs[a][b], vs[a + 1][b], vs[a + 1][b + 1], vs[a][b + 1]]
                quv = [uvs[a][b], uvs[a + 1][b], uvs[a + 1][b + 1], uvs[a][b + 1]]
                if flip:
                    q.reverse(); quv.reverse()
                try:
                    f = self.bm.faces.new(q)
                except ValueError:
                    continue
                for loop, uv in zip(f.loops, quv):
                    loop[self.uv].uv = uv

    def box(self, center, size, rot=(0, 0, 0)):
        mtx = Matrix.Translation(center) @ Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X") @ Matrix.Diagonal((*size, 1))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=mtx)
        self._boxmap(res["verts"])

    def cylinder(self, center, r1, r2, depth, seg=12, rot=(0, 0, 0)):
        mtx = Matrix.Translation(center) @ Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X")
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth, matrix=mtx)
        self._boxmap(res["verts"])

    def blob(self, center, scale, subdiv=1):
        mtx = Matrix.Translation(center) @ Matrix.Diagonal((*scale, 1))
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0, matrix=mtx)
        self._boxmap(res["verts"])

    def _boxmap(self, verts):
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for loop in f.loops:
                c = loop.vert.co
                u, v = [(c.y, c.z), (c.x, c.z), (c.x, c.y)][ax]
                loop[self.uv].uv = (u / 2.0, v / 2.0)

    def build(self, origin=None):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        me.materials.append(self.material)
        obj = bpy.data.objects.new(self.name, me)
        SCN.collection.objects.link(obj)
        for p in me.polygons:
            p.use_smooth = True
        if origin is not None:
            off = Vector(origin)
            me.transform(Matrix.Translation(-off))
            obj.location = off
        return obj


# ---------------------------------------------------------------- openings
DOOR_X0, DOOR_X1 = 8.0, 13.4           # 5.4 m wide, on the +Y side
DOOR_Z0, DOOR_Z1 = 1.25, 5.25          # lower deck
WIN_X0, WIN_X1 = -34.0, -31.0          # the window Noah opened (創8:6)
WIN_Z0, WIN_Z1 = 9.7, 10.9
COVER_X0, COVER_X1 = -9.0, 9.0         # the covering he removed (創8:13), +Y slope


def in_door(x, z, side):
    return side > 0 and DOOR_X0 < x < DOOR_X1 and DOOR_Z0 < z < DOOR_Z1


def in_window(x, z, side):
    return side > 0 and WIN_X0 < x < WIN_X1 and WIN_Z0 < z < WIN_Z1


# ---------------------------------------------------------------- planking (strakes)
hull = Part("hull_planks", M["hull"])
N_STRAKE = 24
for side in (1, -1):
    for k in range(N_STRAKE):
        rows, uvs = [], []
        for s in STATIONS:
            pts, arc = half_section(s)
            total = arc[-1]
            d0 = total * k / N_STRAKE
            d1 = total * (k + 1) / N_STRAKE + 0.06          # slight lap over the next strake
            lap = 0.045 * (k % 2)                           # alternate strakes stand proud
            row, uvr = [], []
            for j in range(3):
                d = d0 + (d1 - d0) * j / 2
                y, z = point_at_arc(pts, arc, d)
                ny, nz = outward_normal(pts, arc, d)
                x = s * HALF_L
                row.append((x, side * (y + ny * lap), z + nz * lap))
                uvr.append((x / 4.0, (k + j / 2) / 4.0))
            rows.append(row); uvs.append(uvr)
        # carve the door and window openings out of this strake
        keep_rows, keep_uvs = [], []
        segs = []
        cur_r, cur_u = [], []
        for r, u in zip(rows, uvs):
            mid = r[1]
            hole = in_door(mid[0], mid[2], side) or in_window(mid[0], mid[2], side)
            if hole:
                if len(cur_r) > 1:
                    segs.append((cur_r, cur_u))
                cur_r, cur_u = [], []
            else:
                cur_r.append(r); cur_u.append(u)
        if len(cur_r) > 1:
            segs.append((cur_r, cur_u))
        for r, u in segs:
            hull.quad_strip(r, u, flip=side < 0)

# transom ends — vertical planks across the bow and stern faces
for end in (-1, 1):
    s = end
    pts, arc = half_section(s)
    x = s * HALF_L
    full = [(-y, z) for (y, z) in reversed(pts)] + [(y, z) for (y, z) in pts[1:]]
    cy = sum(p[1] for p in full) / len(full)
    ctr = hull.bm.verts.new((x, 0, cy))
    ring = [hull.bm.verts.new((x, y, z)) for (y, z) in full]
    for i in range(len(ring) - 1):
        tri = [ctr, ring[i], ring[i + 1]] if end > 0 else [ctr, ring[i + 1], ring[i]]
        f = hull.bm.faces.new(tri)
        for loop in f.loops:
            c = loop.vert.co
            loop[hull.uv].uv = (c.y / 4.0 + 0.37, c.z / 4.0)
    # close the gap between the transom top and the roof line with a gable board
hull_obj = hull.build()

# ---------------------------------------------------------------- frames, keel, stem posts
frames = Part("frames", M["frame"])
FRAME_STEP = 3.0
x = -HALF_L + 1.2
frame_xs = []
while x < HALF_L - 1.0:
    frame_xs.append(x)
    x += FRAME_STEP
for fx in frame_xs:
    s = fx / HALF_L
    pts, arc = half_section(s, 8, 8, 5)
    for side in (1, -1):
        prev = None
        for j in range(len(pts)):
            y, z = pts[j]
            ny, nz = outward_normal(pts, arc, arc[j])
            # rib sits just inside the planking: 0.34 deep, 0.28 wide
            inner = (y - ny * 0.36, z - nz * 0.36)
            outer = (y - ny * 0.02, z - nz * 0.02)
            cur = (inner, outer)
            if prev is not None:
                (pi, po), (ci, co) = prev, cur
                rows = [
                    [(fx - 0.14, side * pi[0], pi[1]), (fx - 0.14, side * po[0], po[1]), (fx + 0.14, side * po[0], po[1]), (fx + 0.14, side * pi[0], pi[1]), (fx - 0.14, side * pi[0], pi[1])],
                    [(fx - 0.14, side * ci[0], ci[1]), (fx - 0.14, side * co[0], co[1]), (fx + 0.14, side * co[0], co[1]), (fx + 0.14, side * ci[0], ci[1]), (fx - 0.14, side * ci[0], ci[1])],
                ]
                uvs = [[(0, arc[j - 1] / 2), (0.1, arc[j - 1] / 2), (0.2, arc[j - 1] / 2), (0.3, arc[j - 1] / 2), (0.4, arc[j - 1] / 2)],
                       [(0, arc[j] / 2), (0.1, arc[j] / 2), (0.2, arc[j] / 2), (0.3, arc[j] / 2), (0.4, arc[j] / 2)]]
                frames.quad_strip(rows, uvs, flip=side < 0)
            prev = cur
# keel
kx = [s * HALF_L for s in STATIONS]
rows, uvs = [], []
for s in STATIONS:
    z0 = keel_at(s)
    x = s * HALF_L
    rows.append([(x, -0.45, z0), (x, -0.45, z0 - 0.55), (x, 0.45, z0 - 0.55), (x, 0.45, z0), (x, -0.45, z0)])
    uvs.append([(x / 4, 0), (x / 4, 0.14), (x / 4, 0.36), (x / 4, 0.5), (x / 4, 0.64)])
frames.quad_strip(rows, uvs)
# stem and stern posts
for end in (-1, 1):
    s = end * 0.995
    frames.box((s * HALF_L + end * 0.15, 0, (keel_at(s) + side_top(s)) / 2 + 0.3), (0.6, 0.9, side_top(s) - keel_at(s) + 1.6))
frames_obj = frames.build()

# ---------------------------------------------------------------- decks (創6:16 上、中、下三層)
DECK_Z = [1.25, 5.25, 8.95]
DECK_T = 0.28
HATCHES = [(-24.0, -19.5), (26.0, 30.5)]   # ladder wells, on the −Y side of the aisle
decks = []
for di, dz in enumerate(DECK_Z):
    part = Part(f"deck_{di}", M["deck"])
    # three longitudinal strips; the middle one is interrupted at the ladder wells
    strips = [(-1.0, -0.62, False), (-0.62, -0.18, True), (-0.18, 1.0, False)]
    for (f0, f1, holed) in strips:
        seg_rows, seg_uvs = [], []
        segments = []
        for s in STATIONS:
            x = s * HALF_L
            w = half_width_at(s, dz) - 0.05
            if w <= 0.5:
                continue
            in_hatch = holed and any(a < x < b for a, b in HATCHES) and di > 0
            if in_hatch:
                if len(seg_rows) > 1:
                    segments.append((seg_rows, seg_uvs))
                seg_rows, seg_uvs = [], []
                continue
            y0, y1 = f0 * w, f1 * w
            seg_rows.append([(x, y0, dz), (x, y1, dz)])
            seg_uvs.append([(x / 4, y0 / 4), (x / 4, y1 / 4)])
        if len(seg_rows) > 1:
            segments.append((seg_rows, seg_uvs))
        for r, u in segments:
            part.quad_strip(r, u, flip=True)
            # underside so the deck reads from below
            part.quad_strip([[(p[0], p[1], p[2] - DECK_T) for p in row] for row in r], u)
    # deck beams under each deck, on the frame stations
    for fx in frame_xs:
        s = fx / HALF_L
        w = half_width_at(s, dz - DECK_T) - 0.1
        if w > 1:
            part.box((fx, 0, dz - DECK_T - 0.2), (0.3, 2 * w, 0.4))
    decks.append(part.build())

# ---------------------------------------------------------------- posts between decks
posts = Part("posts", M["frame"])
for di in range(len(DECK_Z)):
    z_bot = DECK_Z[di]
    z_top = DECK_Z[di + 1] - DECK_T - 0.4 if di + 1 < len(DECK_Z) else ROOF_TOP - 1.2
    for fx in frame_xs[1:-1:2]:
        s = fx / HALF_L
        if beam_at(s) < 0.7:
            continue
        for py in (-3.2, 3.2):
            posts.box((fx, py, (z_bot + z_top) / 2), (0.34, 0.34, z_top - z_bot))
        # carlings along the posts
    for py in (-3.2, 3.2):
        xs = [fx for fx in frame_xs if beam_at(fx / HALF_L) >= 0.7]
        z = z_top if di + 1 < len(DECK_Z) else ROOF_TOP - 1.2
        posts.box(((xs[0] + xs[-1]) / 2, py, z + 0.2), (xs[-1] - xs[0] + 0.4, 0.34, 0.4))
posts_obj = posts.build()

# ---------------------------------------------------------------- ladders at the wells
ladders = Part("ladders", M["trim"])
for di in range(1, len(DECK_Z)):
    z0, z1 = DECK_Z[di - 1], DECK_Z[di]
    for (a, b) in HATCHES:
        run = b - a - 0.4
        n = 12
        y = -0.4 * half_width_at(0, z1)
        for side in (-0.9, 0.9):
            ang = math.atan2(z1 - z0, run)
            ln = math.hypot(z1 - z0, run)
            ladders.box(((a + b) / 2, y + side, (z0 + z1) / 2), (ln, 0.12, 0.3), rot=(0, -ang, 0))
        for i in range(1, n):
            t = i / n
            ladders.box((a + 0.2 + run * t, y, z0 + (z1 - z0) * t), (0.32, 1.8, 0.08))
ladders_obj = ladders.build()

# ---------------------------------------------------------------- lower deck: pens (創6:14「一間一間」)
pens = Part("pens", M["trim"])
straw = Part("straw", M["straw"])
dz = DECK_Z[0]
PEN_STEP = 4.5
xs = [x for x in frame_xs if abs(x) < HALF_L - 6]
for side in (1, -1):
    y_in = 3.6
    for i in range(0, len(xs) - 1, 1):
        x = xs[i]
        s = x / HALF_L
        w = half_width_at(s, dz + 1) - 0.5
        if w - y_in < 2:
            continue
        # partition: posts and three rails across the pen
        if i % 2 == 0:
            for t in (0.0, 0.5, 1.0):
                pens.box((x, side * (y_in + (w - y_in) * t), dz + 0.8), (0.18, 0.18, 1.6))
            for hz in (0.45, 0.95, 1.45):
                pens.box((x, side * (y_in + w) / 2, dz + hz), (0.1, w - y_in, 0.12))
            # front rail along the aisle with a gap for the gate
            nx = xs[min(i + 2, len(xs) - 1)]
            for hz in (0.6, 1.3):
                pens.box((x + (nx - x) * 0.3, side * y_in, dz + hz), ((nx - x) * 0.55, 0.1, 0.12))
        straw.box((x + FRAME_STEP / 2, side * (y_in + w) / 2, dz + 0.04), (FRAME_STEP - 0.2, w - y_in - 0.2, 0.08))
pens_obj = pens.build()
straw_obj = straw.build()

# ---------------------------------------------------------------- middle deck: stores (創6:21)
stores = Part("stores", M["clay"])
sacks = Part("sacks", M["cloth"])
shelves = Part("shelves", M["trim"])
dz = DECK_Z[1]
k = 0
for side in (1, -1):
    for x in xs[1:-1]:
        s = x / HALF_L
        w = half_width_at(s, dz + 1) - 0.6
        if w < 5:
            continue
        k += 1
        kind = k % 3
        if kind == 0:
            # rack of jars
            shelves.box((x, side * (w - 0.9), dz + 1.2), (2.6, 1.5, 0.08))
            shelves.box((x, side * (w - 0.9), dz + 2.2), (2.6, 1.5, 0.08))
            for sx in (-1.0, -0.33, 0.33, 1.0):
                for (zz, h) in ((dz + 0.0, 1.1), (dz + 1.24, 0.9)):
                    stores.cylinder((x + sx, side * (w - 0.9), zz + h / 2), 0.28, 0.16, h, seg=10)
        elif kind == 1:
            # grain bin
            shelves.box((x, side * (w - 1.3), dz + 0.9), (2.6, 2.4, 1.8))
            sacks.blob((x - 0.6, side * (w - 3.0), dz + 0.35), (0.5, 0.38, 0.35))
            sacks.blob((x + 0.4, side * (w - 3.1), dz + 0.35), (0.48, 0.4, 0.35))
        else:
            # sacks piled against the hull
            for j in range(5):
                sacks.blob((x - 1.0 + j * 0.5, side * (w - 0.7 - (j % 2) * 0.6), dz + 0.35 + (j % 3 == 2) * 0.6), (0.5, 0.36, 0.34))
stores_obj = stores.build()
sacks_obj = sacks.build()
shelves_obj = shelves.build()

# ---------------------------------------------------------------- upper deck: the family's rooms (創7:13)
rooms = Part("rooms", M["trim"])
bedding = Part("bedding", M["cloth"])
dz = DECK_Z[2]
for i, cx in enumerate((-12.0, -4.5, 3.0, 10.5)):
    y0 = 3.8
    s = cx / HALF_L
    w = half_width_at(s, dz + 1) - 0.4
    depth = w - y0
    ht = 2.3
    # walls: back is the hull, front along the aisle with a doorway
    rooms.box((cx - 3.4, (y0 + w) / 2, dz + ht / 2), (0.12, depth, ht))
    rooms.box((cx + 3.4, (y0 + w) / 2, dz + ht / 2), (0.12, depth, ht))
    rooms.box((cx - 1.9, y0, dz + ht / 2), (3.0, 0.12, ht))
    rooms.box((cx + 2.3, y0, dz + ht / 2), (2.2, 0.12, ht))
    rooms.box((cx + 0.2, y0, dz + ht - 0.2), (1.2, 0.12, 0.4))
    bedding.box((cx - 1.6, w - 1.2, dz + 0.2), (2.4, 1.6, 0.35))
    bedding.box((cx + 1.6, w - 1.2, dz + 0.2), (2.4, 1.6, 0.35))
# a work area with a long table and water jars
rooms.box((-24.0, 4.8, dz + 0.85), (6.0, 1.4, 0.12))
for tx in (-26.6, -21.4):
    for ty in (4.3, 5.3):
        rooms.box((tx, ty, dz + 0.42), (0.14, 0.14, 0.84))
for j in range(6):
    stores2_x = -30.0 + j * 0.8
    rooms.cylinder((stores2_x, 5.6, dz + 0.5), 0.3, 0.18, 1.0, seg=10)
# perches for the birds (創6:20 飛鳥各從其類) on the −Y side
for x in range(-40, 44, 6):
    s = x / HALF_L
    w = half_width_at(s, dz + 1.5) - 0.6
    if w < 5:
        continue
    for hz in (0.9, 1.6):
        rooms.box((x, -(w - 1.4), dz + hz), (4.8, 0.08, 0.08))
    rooms.box((x - 2.4, -(w - 1.4), dz + 0.9), (0.12, 0.12, 1.8))
rooms_obj = rooms.build()
bedding_obj = bedding.build()

# ---------------------------------------------------------------- roof and the one-cubit light opening
roof = Part("roof_planks", M["roof"])
cover = Part("cover", M["roof"])
OVER = 0.9
ROOF_XS = sorted(set([round(s * HALF_L, 4) for s in STATIONS] + [COVER_X0, COVER_X1]))
for side in (1, -1):
    for part, x_lo, x_hi in ((roof, -2, COVER_X0), (roof, COVER_X1, 2), (cover, COVER_X0, COVER_X1)):
        if side < 0 and part is cover:
            continue
        rows, uvs = [], []
        for x in ROOF_XS:
            s = x / HALF_L
            if part is roof and side > 0 and COVER_X0 + 0.01 < x < COVER_X1 - 0.01:
                continue
            if part is cover and not (COVER_X0 - 0.01 <= x <= COVER_X1 + 0.01):
                continue
            w = HALF_B * beam_at(s) + OVER
            zg = side_top(s) - 0.25
            row, uvr = [], []
            for j in range(9):
                t = j / 8
                y = w + (0.9 - w) * t
                z = zg + (ROOF_TOP - zg) * t
                row.append((x, side * y, z))
                uvr.append((x / 4, t * (w - 0.9) / 4))
            rows.append(row); uvs.append(uvr)
        # split the +Y slope where the cover sits
        if part is roof and side > 0:
            left = [(r, u) for r, u in zip(rows, uvs) if r[0][0] <= COVER_X0 + 0.01]
            right = [(r, u) for r, u in zip(rows, uvs) if r[0][0] >= COVER_X1 - 0.01]
            for chunk in (left, right):
                if len(chunk) > 1:
                    roof.quad_strip([c[0] for c in chunk], [c[1] for c in chunk], flip=True)
                    roof.quad_strip([[(p[0], p[1], p[2] - 0.22) for p in c[0]] for c in chunk], [c[1] for c in chunk])
        elif len(rows) > 1:
            part.quad_strip(rows, uvs, flip=side < 0)
            part.quad_strip([[(p[0], p[1], p[2] - 0.22) for p in r] for r in rows], uvs, flip=side > 0)
    # battens across the roof so the slope has relief
    for x in range(int(-HALF_L) + 2, int(HALF_L) - 1, 3):
        s = x / HALF_L
        w = HALF_B * beam_at(s) + OVER
        zg = side_top(s) - 0.25
        ang = math.atan2(ROOF_TOP - zg, w - 0.9)
        ln = math.hypot(ROOF_TOP - zg, w - 0.9)
        target = cover if (side > 0 and COVER_X0 < x < COVER_X1) else roof
        target.box((x, side * (w + 0.9) / 2, (zg + ROOF_TOP) / 2 + 0.1), (0.2, ln, 0.14), rot=(-side * ang, 0, 0))
# gable boards closing the ends under the roof
for end in (-1, 1):
    s = end
    x = s * HALF_L
    w = HALF_B * beam_at(s)
    zg = side_top(s)
    v = [roof.bm.verts.new(p) for p in ((x, -w, zg), (x, w, zg), (x, 0.9, ROOF_TOP), (x, -0.9, ROOF_TOP))]
    f = roof.bm.faces.new(v if end > 0 else list(reversed(v)))
    for loop in f.loops:
        c = loop.vert.co
        loop[roof.uv].uv = (c.y / 4, c.z / 4)
roof_obj = roof.build()
cover_obj = cover.build(origin=(0, HALF_B * 0.5, ROOF_TOP))

# ridge cap on posts; the open band beneath it is the tsohar
ridge = Part("ridge", M["roof"])
rows, uvs = [], []
for s in STATIONS:
    x = s * HALF_L
    rows.append([(x, -CAP_HALF, CAP_BOT), (x, 0, H), (x, CAP_HALF, CAP_BOT)])
    uvs.append([(x / 4, 0), (x / 4, 0.45), (x / 4, 0.9)])
ridge.quad_strip(rows, uvs, flip=True)
ridge.quad_strip([[(p[0], p[1], p[2] - 0.18) for p in r] for r in rows], uvs)
for end in (-1, 1):
    x = end * HALF_L
    v = [ridge.bm.verts.new(p) for p in ((x, -CAP_HALF, CAP_BOT - 0.18), (x, CAP_HALF, CAP_BOT - 0.18), (x, CAP_HALF, CAP_BOT), (x, 0, H), (x, -CAP_HALF, CAP_BOT))]
    ridge.bm.faces.new(v if end > 0 else list(reversed(v)))
for x in range(int(-HALF_L) + 1, int(HALF_L), 3):
    for py in (-0.75, 0.75):
        ridge.box((x, py, ROOF_TOP + TSOHAR / 2 - 0.05), (0.22, 0.22, TSOHAR + 0.3))
ridge_obj = ridge.build()

# ---------------------------------------------------------------- door, frame, ramp (創6:16, 7:16)
trim = Part("door_frame", M["trim"])
yd = HALF_B * beam_at(DOOR_X0 / HALF_L)
trim.box(((DOOR_X0 + DOOR_X1) / 2, yd + 0.12, DOOR_Z1 + 0.2), (DOOR_X1 - DOOR_X0 + 0.9, 0.35, 0.4))
trim.box(((DOOR_X0 + DOOR_X1) / 2, yd + 0.12, DOOR_Z0 - 0.15), (DOOR_X1 - DOOR_X0 + 0.9, 0.4, 0.3))
for xx in (DOOR_X0 - 0.2, DOOR_X1 + 0.2):
    trim.box((xx, yd + 0.12, (DOOR_Z0 + DOOR_Z1) / 2), (0.4, 0.35, DOOR_Z1 - DOOR_Z0 + 0.6))
# window frame
yw = HALF_B * beam_at(WIN_X0 / HALF_L)
trim.box(((WIN_X0 + WIN_X1) / 2, yw + 0.1, WIN_Z1 + 0.1), (WIN_X1 - WIN_X0 + 0.5, 0.25, 0.22))
trim.box(((WIN_X0 + WIN_X1) / 2, yw + 0.1, WIN_Z0 - 0.1), (WIN_X1 - WIN_X0 + 0.5, 0.3, 0.22))
for xx in (WIN_X0 - 0.12, WIN_X1 + 0.12):
    trim.box((xx, yw + 0.1, (WIN_Z0 + WIN_Z1) / 2), (0.24, 0.25, WIN_Z1 - WIN_Z0 + 0.4))
trim_obj = trim.build()

door = Part("door", M["hull"])
dw, dh = DOOR_X1 - DOOR_X0, DOOR_Z1 - DOOR_Z0
for j in range(9):                                         # vertical boards
    door.box((DOOR_X0 + dw * (j + 0.5) / 9, yd + 0.22, (DOOR_Z0 + DOOR_Z1) / 2), (dw / 9 - 0.03, 0.2, dh))
for zz in (0.18, 0.5, 0.82):                               # ledges
    door.box(((DOOR_X0 + DOOR_X1) / 2, yd + 0.38, DOOR_Z0 + dh * zz), (dw - 0.3, 0.14, 0.34))
door.box(((DOOR_X0 + DOOR_X1) / 2, yd + 0.38, DOOR_Z0 + dh * 0.5), (0.25, 0.14, dh * 0.9), rot=(0, math.atan2(dh * 0.64, dw - 0.6), 0))
# hinge on the stern-side jamb; the door swings outward about Z
door_obj = door.build(origin=(DOOR_X1, yd + 0.22, DOOR_Z0))

shutter = Part("window_shutter", M["hull"])
ww, wh = WIN_X1 - WIN_X0, WIN_Z1 - WIN_Z0
for j in range(5):
    shutter.box((WIN_X0 + ww * (j + 0.5) / 5, yw + 0.18, (WIN_Z0 + WIN_Z1) / 2), (ww / 5 - 0.02, 0.12, wh))
shutter.box(((WIN_X0 + WIN_X1) / 2, yw + 0.28, WIN_Z0 + wh * 0.5), (ww - 0.2, 0.1, 0.18))
# hinged along the top edge
shutter_obj = shutter.build(origin=((WIN_X0 + WIN_X1) / 2, yw + 0.18, WIN_Z1))

ramp = Part("ramp", M["deck"])
RAMP_LEN = 16.0
ang = math.atan2(DOOR_Z0 + 0.6, RAMP_LEN)
cx = (DOOR_X0 + DOOR_X1) / 2
cy = yd + 0.4 + math.cos(ang) * RAMP_LEN / 2
czz = (DOOR_Z0 - 0.6) / 2
ramp.box((cx, cy, czz), (dw - 0.3, RAMP_LEN, 0.32), rot=(-ang, 0, 0))
for i in range(1, 16):                                     # cleats
    t = i / 16
    ramp.box((cx, yd + 0.4 + math.cos(ang) * RAMP_LEN * t, DOOR_Z0 - (DOOR_Z0 + 0.6) * t + 0.2), (dw - 0.5, 0.18, 0.12))
for sx in (-1, 1):
    ramp.box((cx + sx * (dw / 2 - 0.1), cy, czz + 1.1), (0.14, RAMP_LEN, 0.14), rot=(-ang, 0, 0))
    for i in range(0, 6):
        t = i / 5
        ramp.box((cx + sx * (dw / 2 - 0.1), yd + 0.4 + math.cos(ang) * RAMP_LEN * t, DOOR_Z0 - (DOOR_Z0 + 0.6) * t + 0.5), (0.14, 0.14, 1.2))
ramp_obj = ramp.build()

# ---------------------------------------------------------------- export
arkset = [o for o in SCN.objects if o.type == "MESH"]
for o in SCN.objects:
    o.select_set(False)
for o in arkset:
    o.select_set(True)
bpy.context.view_layer.objects.active = arkset[0]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True,
                          export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT")
tris = sum(len(o.data.polygons) for o in arkset)
print("exported", OUT, "objects", len(arkset), "faces", tris, "size", os.path.getsize(OUT))
