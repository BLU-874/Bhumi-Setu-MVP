/**
 * Authoritative Study Area configuration for the Bhumi-Setu interactive map.
 * 
 * To change the initial map location or study area:
 * Edit center_lat, center_lng, default_zoom, and name here.
 */
export interface StudyAreaConfig {
  id: string;
  name: string;
  description: string;
  origin_lon: number;
  origin_lat: number;
  center_lat: number;
  center_lng: number;
  default_zoom: number;
}

export const STUDY_AREA: StudyAreaConfig = {
  id: 'pune_kothrud',
  name: 'Pune Residential Study Area (Kothrud)',
  description: 'Normal urban residential neighborhood in Kothrud, Pune',
  origin_lon: 73.8050,
  origin_lat: 18.5020,
  center_lat: 18.5080,
  center_lng: 73.8130,
  default_zoom: 16,
};
