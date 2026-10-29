# Authored backdrop collision recovery

Target: source boss-A background and the asset called 新手关02背景, actually used by tutorial floor7. Raw SCS data
is extracted by tools/reverse/room-components.py; parent links plus inherited PaperSprite rotation are followed before
the child Box transform. Manifest with exact input hashes: studio/logs/parity-room-fog/components-r1/authored-components.json.

Boss has16airwall children, tutorial has10airwalls and4braziers. Source airwall BoxExtent100/100/100, static physics/query
profile房间地块; child rotation/scale produces exact oriented rectangles. Source bVisible=false means these collision
primitives are not visible stone props. The first diagnostic build incorrectly reused large genericstone geometry;
its dev1shots remain rejected. The corrected build exposes only the existing kit's raster perimeter and thin exact
boundary edge markers as a backdrop approximation. No extra collision is added by those markers.

The shared sweep transforms the probe segment into a rotated box's local frame, uses the original AABB faces/rounded
corners, then rotates normals and impact points back. Existing axis-aligned paths are unchanged. Runtime traces and
hero preview consume the same exact primitives, bypassing raster wall collision only for these authored backgrounds.
Terrain membership/raster floor still uses source64uu cells, now excluded where centre lies within real sourcewalls.
Source child objects are instantiated and attached for actual lifetime/recursive cleanup; tutorial braziers have their
original collision and display locations. Caltrop fixed-square vsrotated-box movement uses swept separating axes.

Tests:16actual sourcewalls face/oblique hits, worldcoordinates/normals, non-AABB cornerclearance, initialoverlap/touch,
tutorial inheritedrotation, actualworld/preview identical contact, pureviews and childcleanup. Boss +X contact at hero
radius56 is source738−375−56=307. Sourcegrid artificial+X boundary is no longer used for that room.

Limits: collisions remain planar; exact3D heights/Chaoscontactoffsets and sourcebackgroundspritegeometry are not
certified. The procedural steppedfloor/perimeter is a visible approximation to a sourcecontinuousedge, not claimed
originalvisualparity. Fog is a separate followup within this card. Gameplay proof must include normalspawn/naturalboss
movement; controlledroom screenshots by themselves do not establish the completeflow.
