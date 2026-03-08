import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faUserCircle, faMusic, faSpinner, faSearch, faSort } from '@fortawesome/free-solid-svg-icons';
import { MusicService, Artist } from '../services/music.service';

export type ArtistSortOption = 'name_asc' | 'name_desc' | 'recently_added' | 'last_updated' | 'most_tracks' | 'most_storage';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="home-page">
      <div class="home-header">
        <h1 class="home-title">
          <fa-icon [icon]="faMusic" class="me-2" />
          Artists
        </h1>
        <p class="home-subtitle text-muted">Click an artist to open their page</p>
      </div>

      @if (!loading && artists.length > 0) {
        <div class="home-toolbar">
          <div class="search-wrap">
            <fa-icon [icon]="faSearch" class="search-icon" />
            <input
              type="text"
              class="form-control search-input"
              placeholder="Search artists..."
              [value]="searchQuery"
              (input)="onSearchInput($event)"
              autocomplete="off" />
          </div>
          <div class="sort-wrap">
            <fa-icon [icon]="faSort" class="sort-icon" />
            <select class="form-select sort-select" (change)="onSortChange($event)">
              <option value="name_asc">Alphabetical (A–Z)</option>
              <option value="name_desc">Alphabetical (Z–A)</option>
              <option value="recently_added">Recently added</option>
              <option value="last_updated">Last updated</option>
              <option value="most_tracks">Most tracks</option>
              <option value="most_storage">Most storage</option>
            </select>
          </div>
        </div>
      }

      @if (loading) {
        <div class="text-center p-5">
          <fa-icon [icon]="faSpinner" size="2x" class="text-muted fa-spin" />
          <p class="mt-3 text-muted">Loading artists...</p>
        </div>
      } @else if (artists.length === 0) {
        <div class="empty-state">
          <fa-icon [icon]="faUserCircle" size="4x" class="text-muted mb-3" />
          <h4>No artists yet</h4>
          <p class="text-muted">Add an artist from the sidebar to get started.</p>
        </div>
      } @else if (filteredArtists.length === 0) {
        <div class="empty-state">
          <fa-icon [icon]="faSearch" size="4x" class="text-muted mb-3" />
          <h4>No artists match your search</h4>
          <p class="text-muted">Try a different search term.</p>
        </div>
      } @else {
        <div class="artists-grid">
          @for (artist of filteredArtists; track artist.id) {
            <button
              type="button"
              class="artist-card"
              (click)="selectArtist(artist)">
              <h3 class="artist-card-name">{{ artist.name }}</h3>
              <div class="artist-card-stats">
                <span class="stat">{{ artist.file_count ?? 0 }} mp3 file{{ (artist.file_count ?? 0) !== 1 ? 's' : '' }}</span>
                <span class="stat">{{ formatSizeMb(artist.total_size ?? 0) }} MB</span>
              </div>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .home-page {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
      min-height: 0;
    }

    .home-header {
      margin-bottom: 2rem;
    }

    .home-title {
      font-size: 1.75rem;
      font-weight: 600;
      margin: 0 0 0.25rem 0;
    }

    .home-subtitle {
      margin: 0;
      font-size: 0.95rem;
    }

    .home-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .search-wrap {
      position: relative;
      flex: 1;
      min-width: 200px;
      max-width: 320px;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--bs-secondary);
      pointer-events: none;
    }

    .search-input {
      padding-left: 2.25rem;
    }

    .sort-wrap {
      position: relative;
      display: flex;
      align-items: center;
      min-width: 180px;
    }

    .sort-icon {
      color: var(--bs-secondary);
      margin-right: 0.5rem;
      flex-shrink: 0;
    }

    .sort-select {
      flex: 1;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }

    .empty-state h4 {
      margin-bottom: 0.5rem;
    }

    .artists-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .artist-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1.5rem 1rem;
      background-color: var(--bs-secondary-bg);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }

    .artist-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--bs-primary);
    }

    .artist-card-name {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      word-break: break-word;
      line-height: 1.3;
    }

    .artist-card-stats {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.85rem;
      color: var(--bs-secondary);
    }

    .artist-card-stats .stat {
      white-space: nowrap;
    }
  `]
})
export class HomeComponent implements OnInit {
  @Output() artistSelected = new EventEmitter<Artist>();

  private musicService = inject(MusicService);

  artists: Artist[] = [];
  loading = false;
  searchQuery = '';
  sortBy: ArtistSortOption = 'name_asc';

  faUserCircle = faUserCircle;
  faMusic = faMusic;
  faSpinner = faSpinner;
  faSearch = faSearch;
  faSort = faSort;

  get filteredArtists(): Artist[] {
    const q = this.searchQuery.trim().toLowerCase();
    let list = q
      ? this.artists.filter(a => a.name.toLowerCase().includes(q))
      : [...this.artists];
    const opt = this.sortBy;
    if (opt === 'name_asc') list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    else if (opt === 'name_desc') list.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
    else if (opt === 'recently_added' || opt === 'last_updated') list.sort((a, b) => (b.modified_at ?? 0) - (a.modified_at ?? 0));
    else if (opt === 'most_tracks') list.sort((a, b) => (b.file_count ?? 0) - (a.file_count ?? 0));
    else if (opt === 'most_storage') list.sort((a, b) => (b.total_size ?? 0) - (a.total_size ?? 0));
    return list;
  }

  ngOnInit() {
    this.loadArtists();
  }

  onSearchInput(e: Event) {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  onSortChange(e: Event) {
    this.sortBy = (e.target as HTMLSelectElement).value as ArtistSortOption;
  }

  loadArtists() {
    this.loading = true;
    this.musicService.getArtists().subscribe({
      next: (list) => {
        this.artists = list;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading artists:', err);
        this.loading = false;
        this.artists = [];
      }
    });
  }

  formatSizeMb(bytes: number): string {
    if (bytes === 0) return '0';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? mb.toFixed(1) : mb.toFixed(2);
  }

  selectArtist(artist: Artist) {
    this.artistSelected.emit(artist);
  }
}
