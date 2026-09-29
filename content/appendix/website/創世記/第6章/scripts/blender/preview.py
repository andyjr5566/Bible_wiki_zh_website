"""Render quick previews of the current build scene (for checking geometry only).

Set PREVIEW_DIR and PREVIEW_SHOTS="name:x,y,z:tx,ty,tz;..." before sending, or edit below.
"""
import math
import os

import bpy
from mathutils import Vector

SCN = bpy.data.scenes.get(os.environ.get("ARK_SCENE") or "ark_build")
bpy.context.window.scene = SCN
OUT_DIR = os.environ.get("PREVIEW_DIR") or r"C:\Users\ANDYJ_~1\AppData\Local\Temp\claude\c--Obsidian-Hermes-scripture\9d0ef271-87ff-4044-9cad-2a12e9ca1157\scratchpad\bl"
os.makedirs(OUT_DIR, exist_ok=True)

SHOTS = os.environ.get("PREVIEW_SHOTS") or "front:95,70,40:0,0,6;side:10,48,6:10,0,4;stern:-110,-40,30:-40,0,6;inside:-30,-6,3:10,6,2.6;top:0,0,120:0,0,0"

SCN.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
SCN.render.resolution_x = 1200
SCN.render.resolution_y = 675
SCN.render.image_settings.file_format = "PNG"

if not SCN.world:
    SCN.world = bpy.data.worlds.new("prev_world")
SCN.world.use_nodes = True
bg = SCN.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.55, 0.62, 0.72, 1)
    bg.inputs[1].default_value = 1.0

sun = SCN.objects.get("prev_sun")
if not sun:
    sun = bpy.data.objects.new("prev_sun", bpy.data.lights.new("prev_sun", "SUN"))
    SCN.collection.objects.link(sun)
sun.data.energy = 4
sun.rotation_euler = (math.radians(50), 0, math.radians(35))

cam = SCN.objects.get("prev_cam")
if not cam:
    cam = bpy.data.objects.new("prev_cam", bpy.data.cameras.new("prev_cam"))
    SCN.collection.objects.link(cam)
cam.data.lens = 28
cam.data.clip_end = 2000
SCN.camera = cam

for shot in SHOTS.split(";"):
    name, p, t = shot.split(":")
    cam.location = Vector([float(v) for v in p.split(",")])
    d = Vector([float(v) for v in t.split(",")]) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    SCN.render.filepath = os.path.join(OUT_DIR, name + ".png")
    bpy.ops.render.render(write_still=True, scene=SCN.name)
print("rendered", SHOTS)
