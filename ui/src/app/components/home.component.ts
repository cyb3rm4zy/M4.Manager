import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faUserCircle, faMusic, faSpinner } from '@fortawesome/free-solid-svg-icons'; // faUserCircle for empty state only
import { MusicService, Artist } from '../services/music.service';

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
      } @else {
        <div class="artists-grid">
          @for (artist of artists; track artist.id) {
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

  faUserCircle = faUserCircle;
  faMusic = faMusic;
  faSpinner = faSpinner;

  ngOnInit() {
    this.loadArtists();
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
