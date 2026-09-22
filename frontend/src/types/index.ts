import type { Feature, FeatureCollection, Geometry } from 'geojson';
export type Status = 'matched' | 'needs_review' | 'conflict';
export type Source = {source_type?:'ai_derived_drone_footprint';demonstration?:boolean;provenance?:Record<string,string|null>;id:string;kind:'cadastral'|'buildings'|'gnss';name:string;label:string;feature_count:number;source_crs:string;analysis_crs:string;display_crs:string;fields:string[];status:string;quality:Record<string,number>};
export type Summary = {total_parcels:number;matched:number;needs_review:number;conflict:number;avg_confidence:number;review_required:number};
export type Run = {source_ids?:{cadastral:string;buildings:string;gnss:string};id:string;status:string;started_at:string;completed_at?:string;summary?:Summary;duration_seconds?:number;quality_flags?:Record<string,number>;stages:{name:string;status:string;detail?:string}[]};
export type Health = {status:string;storage_mode:string;postgis_connected:boolean};
export type DatabaseStatus = {persistence_mode:string;database_reachable:boolean;postgis_available:boolean;schema_ready:boolean;geometry_ready:boolean;spatial_query_ok:boolean;ready:boolean;message:string};
export type Evidence = {source:unknown;candidate:unknown;available:boolean;similarity_pct:number|null};
export type MLInfo = {model_available?:boolean;model_version?:string|null;deterministic_confidence?:number;ml_ranked_candidate_id?:string|null;ml_match_probability?:number|null;ml_rank?:number|null;ml_candidates?:{candidate_id:string;ml_match_probability:number;ml_rank:number;features:Record<string,number|null>}[]};
export type ResultProps = MLInfo & {parcel_id:string;status:Status;confidence:number;geometry_overlap_pct:number;attribute_match_pct:number;gnss_verified:boolean;gnss_point_id:string|null;cadastral:Record<string,unknown>;footprint_properties:Record<string,unknown>|null;matched_footprint_id:string|null;validation_flags:string[];recommendation:string;review_required:boolean;decision_status:string;attribute_evidence:Record<string,Evidence>;geometry_quality:{original_valid:boolean;repaired:boolean;result_valid:boolean;reason:string};validation:Record<string,unknown>;confidence_explanation:{geometry_contribution:number;attribute_contribution:number;base_confidence:number;gnss_boost:number;final_confidence:number}};
export type ResultFeature = Feature<Geometry,ResultProps>;
export type Results = FeatureCollection<Geometry,ResultProps> & {summary:Summary|null;run_id:string|null};
export type Layers = {cadastral:FeatureCollection;buildings:FeatureCollection;gnss:FeatureCollection;droneBuildings?:FeatureCollection;buildingSourceId?:string};
export type ReviewCase = {id:string;run_id:string;record_id:string;status:'pending'|'investigating'|'resolved';decision:'accepted'|'rejected'|'investigate'|null;reviewer:string|null;note:string|null;decided_at:string|null;version:number;feature:ResultFeature};
export type AuditEvent = {id:number;project_id:string;run_id:string;record_id:string;actor:string;action:string;before:Record<string,unknown>;after:Record<string,unknown>;timestamp:string};

export type ReferenceSource = Omit<Source,'source_type'> & {
 source_type:'real_world_orthophoto_building_data';dataset_type:'real_world_reference';location:string;
 synthetic:false;benchmark_eligible:false;cadastral_truth_available:false;reconciliation_ground_truth_available:false;
 imagery_source:string;imagery_status:string;roads_status:string;available_lalpur_buildings:number;
 representation:string;repository_commit:string;source_file:string;source_file_sha256:string;
 annotation_origin:string;selection:string;license_status:string;read_only:true;
};
