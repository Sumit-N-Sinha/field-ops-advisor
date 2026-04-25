import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FieldNoteRequest {
  observation: string;
  region: string;
  crop_type: string;
}

export interface FieldNoteMatch {
  id: string;
  title: string;
  domain: string;
  category: string;
  region: string;
  crop_or_forest_type: string;
  relevance_score: number;
  evidence_snippet: string;
  char_start: number;
  char_end: number;
}

export interface FieldNoteResponse {
  note_id: string;
  matches: FieldNoteMatch[];
}

export interface RecommendationCitation {
  bullet_index: number;
  quoted_text: string;
  source_char_range: [number, number];
  confidence: 'low' | 'medium' | 'high';
}

export interface RecommendationResponse {
  recommendation_id: string;
  doc_id: string;
  bullets: string[];
  citations: RecommendationCitation[];
  fallback_used: boolean;
  generated_at: string;
}

export interface SopSummary {
  id: string;
  title: string;
  region: string;
  domain: string;
  category: string;
  crop_or_forest_type: string;
  keywords: string[];
  preview: string;
}

export interface SopSearchResponse {
  total: number;
  sops: SopSummary[];
  filters_available: {
    regions: string[];
    domains: string[];
    categories: string[];
    crop_or_forest_types?: string[];
  };
}

export interface MapPlot {
  plot_id: string;
  name: string;
  region: string;
  crop_type: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  hectares: number;
  last_observation: {
    note_id: string;
    text: string;
    timestamp: string;
  } | null;
  active_recommendation: {
    doc_id: string;
    title: string;
    severity: string;
    bullets: string[];
  } | null;
}

export interface MapStateResponse {
  plots: MapPlot[];
}

export interface SopFilters {
  region?: string;
  domain?: string;
  category?: string;
  crop_type?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class FieldOpsApiService {
  private readonly baseUrl = 'http://localhost:3001';

  constructor(private http: HttpClient) {}

  submitFieldNote(note: FieldNoteRequest): Observable<FieldNoteResponse> {
    return this.http.post<FieldNoteResponse>(`${this.baseUrl}/field-note`, note);
  }

  getRecommendation(noteId: string, docId: string): Observable<RecommendationResponse> {
    return this.http.get<RecommendationResponse>(`${this.baseUrl}/recommendation`, {
      params: this.buildParams({ note_id: noteId, doc_id: docId })
    });
  }

  getSops(filters: SopFilters = {}): Observable<SopSearchResponse> {
    return this.http.get<SopSearchResponse>(`${this.baseUrl}/sops`, {
      params: this.buildParams({ ...filters })
    });
  }

  getMapState(plotId?: string): Observable<MapStateResponse> {
    return this.http.get<MapStateResponse>(`${this.baseUrl}/map-state`, {
      params: this.buildParams({ plot_id: plotId })
    });
  }

  private buildParams(params: Record<string, string | number | null | undefined>): HttpParams {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        continue;
      }

      const text = String(value).trim();
      if (!text) {
        continue;
      }

      httpParams = httpParams.set(key, text);
    }

    return httpParams;
  }
}
