"""Authoritative Study Area configuration for synthetic geometries.

Change origin_lon, origin_lat, center_lat, center_lng, default_zoom here to relocate
the synthetic study area. The translation engine will preserve all relative parcel
geometries, IoUs, scores, review cases, and audit trails.
"""

STUDY_AREA = {
    "id": "pune_kothrud",
    "name": "Pune Residential Study Area (Kothrud)",
    "description": "Normal urban residential neighborhood in Kothrud, Pune",
    "origin_lon": 73.8050,
    "origin_lat": 18.5020,
    "center_lat": 18.5080,
    "center_lng": 73.8130,
    "default_zoom": 16,
}
