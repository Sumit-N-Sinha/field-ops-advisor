import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FieldNoteMatch,
  FieldNoteResponse,
  FieldOpsApiService,
  MapStateResponse,
  RecommendationResponse,
  SopSearchResponse,
  SopSummary
} from './field-ops-api.service';

type DashboardTab = 'field-note' | 'recommendations' | 'sops' | 'map-state';

@Component({
  selector: 'app-field-note',
  templateUrl: './field-note.component.html',
  styleUrls: ['./field-note.component.scss']
})
export class FieldNoteComponent implements OnInit {
  activeTab: DashboardTab = 'field-note';

  fieldNoteObservation = 'Brown spots on pine needles, some yellowing at base';
  fieldNoteRegion = 'India';
  fieldNoteCropType = 'Pine plantation';
  fieldNoteResult: FieldNoteResponse | null = null;
  fieldNoteLoading = false;
  fieldNoteError = '';
  noteId = '';

  selectedDocId = 'SOP-0001';
  selectedMatch: FieldNoteMatch | null = null;

  recommendationResult: RecommendationResponse | null = null;
  recommendationLoading = false;
  recommendationError = '';

  sopFilters = {
    region: '',
    domain: '',
    category: '',
    crop_type: '',
    limit: 10
  };
  sopResult: SopSearchResponse | null = null;
  sopLoading = false;
  sopError = '';

  mapPlotId = '';
  mapStateResult: MapStateResponse | null = null;
  mapLoading = false;
  mapError = '';

  constructor(private api: FieldOpsApiService) {}

  ngOnInit(): void {
    void this.loadSops();
    void this.loadMapState();
  }

  setTab(tab: DashboardTab): void {
    this.activeTab = tab;
  }

  selectMatch(match: FieldNoteMatch): void {
    this.selectedDocId = match.id;
    this.selectedMatch = match;
    this.activeTab = 'recommendations';
  }

  selectSop(doc: SopSummary): void {
    this.selectedDocId = doc.id;
    this.selectedMatch = this.fieldNoteResult?.matches?.find((match) => match.id === doc.id) ?? null;
    this.activeTab = 'recommendations';
  }

  async submitFieldNote(): Promise<void> {
    const observation = this.fieldNoteObservation.trim();
    const region = this.fieldNoteRegion.trim();
    const cropType = this.fieldNoteCropType.trim();

    if (!observation || !region || !cropType) {
      this.fieldNoteError = 'Observation, region, and crop type are required.';
      return;
    }

    this.fieldNoteLoading = true;
    this.fieldNoteError = '';

    try {
      const response = await firstValueFrom(
        this.api.submitFieldNote({
          observation,
          region,
          crop_type: cropType
        })
      );

      this.fieldNoteResult = response;
      this.noteId = response.note_id;

      const firstMatch = response.matches?.[0] ?? null;
      if (firstMatch) {
        this.selectMatch(firstMatch);
        await this.loadRecommendation();
      } else {
        this.selectedDocId = '';
        this.selectedMatch = null;
        this.recommendationResult = null;
        this.activeTab = 'recommendations';
        await this.loadMapState();
      }
    } catch (error) {
      this.fieldNoteError = this.describeError(error, 'Submission failed.');
    } finally {
      this.fieldNoteLoading = false;
    }
  }

  async loadRecommendation(noteId: string = this.noteId, docId: string = this.selectedDocId): Promise<void> {
    if (!noteId || !docId) {
      this.recommendationError = 'Choose a note and SOP before generating a recommendation.';
      return;
    }

    this.recommendationLoading = true;
    this.recommendationError = '';

    try {
      this.selectedDocId = docId;
      const match = this.fieldNoteResult?.matches?.find((item) => item.id === docId) ?? null;
      this.selectedMatch = match;

      this.recommendationResult = await firstValueFrom(this.api.getRecommendation(noteId, docId));
      this.activeTab = 'recommendations';
    } catch (error) {
      this.recommendationError = this.describeError(error, 'Recommendation request failed.');
    } finally {
      this.recommendationLoading = false;
    }

    void this.loadMapState();
  }

  async loadSops(): Promise<void> {
    this.sopLoading = true;
    this.sopError = '';

    try {
      this.sopResult = await firstValueFrom(this.api.getSops({
        region: this.sopFilters.region || undefined,
        domain: this.sopFilters.domain || undefined,
        category: this.sopFilters.category || undefined,
        crop_type: this.sopFilters.crop_type || undefined,
        limit: this.sopFilters.limit
      }));
    } catch (error) {
      this.sopError = this.describeError(error, 'SOP lookup failed.');
    } finally {
      this.sopLoading = false;
    }
  }

  resetSopFilters(): void {
    this.sopFilters = {
      region: '',
      domain: '',
      category: '',
      crop_type: '',
      limit: 10
    };
    void this.loadSops();
  }

  async loadMapState(): Promise<void> {
    this.mapLoading = true;
    this.mapError = '';

    try {
      this.mapStateResult = await firstValueFrom(
        this.api.getMapState(this.mapPlotId.trim() || undefined)
      );
    } catch (error) {
      this.mapError = this.describeError(error, 'Map state request failed.');
    } finally {
      this.mapLoading = false;
    }
  }

  trackByIndex(index: number, _item: unknown): number {
    return index;
  }

  formatRange(range: [number, number] | undefined): string {
    if (!range) {
      return 'n/a';
    }

    return `${range[0]}-${range[1]}`;
  }

  private describeError(error: unknown, fallback: string): string {
    const response = error as {
      error?: { error?: string } | string;
      message?: string;
    };

    if (typeof response?.error === 'string' && response.error.trim()) {
      return response.error;
    }

    if (response?.error && typeof response.error === 'object') {
      const nested = response.error.error;
      if (typeof nested === 'string' && nested.trim()) {
        return nested;
      }
    }

    if (typeof response?.message === 'string' && response.message.trim()) {
      return response.message;
    }

    return fallback;
  }
}
