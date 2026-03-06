import { Component, inject, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { MusicService, Artist } from '../services/music.service';
import { DownloadsService } from '../services/downloads.service';
import { Download } from '../interfaces';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="sidebar">
      <div class="sidebar-header">
          <h5 class="sidebar-title">
          <fa-icon [icon]="faUserCircle" class="me-2" />
          Artists
        </h5>
        <button 
          class="btn btn-sm btn-primary add-artist-btn"
          (click)="onAddArtist()"
          title="Add New Artist">
          <fa-icon [icon]="faPlus" />
        </button>
      </div>
      <div class="sidebar-content">
        @if (loading) {
          <div class="text-center p-3">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
        } @else if (artists.length === 0) {
          <div class="text-center p-3 text-muted">
            <small>No artists yet.<br/>Click + to add one.</small>
          </div>
        } @else {
          <ul class="artist-list">
            @for (artist of artists; track artist.id) {
              <li 
                class="artist-item"
                [class.active]="selectedArtist?.id === artist.id"
                (click)="selectArtist(artist)">
                <div class="artist-item-content">
                  <div class="artist-info">
                    <span class="artist-name">{{ artist.name }}</span>
                    @if (getArtistProgress(artist.id)) {
                      <div class="artist-progress">
                        <div class="progress" style="height: 6px; width: 100%;">
                          <div 
                            class="progress-bar" 
                            role="progressbar"
                            [style.width.%]="getArtistProgress(artist.id)?.percent || 0"
                            [attr.aria-valuenow]="getArtistProgress(artist.id)?.percent || 0"
                            aria-valuemin="0"
                            aria-valuemax="100">
                          </div>
                        </div>
                        <small class="progress-text">{{ getArtistProgress(artist.id)?.status || '' }}</small>
                      </div>
                    }
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [`
    .sidebar {
      width: 250px;
      height: 100vh;
      background-color: var(--bs-secondary-bg);
      border-right: 1px solid var(--bs-border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 1rem;
      border-bottom: 1px solid var(--bs-border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--bs-body-bg);
    }

    .sidebar-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
    }

    .add-artist-btn {
      padding: 0.25rem 0.5rem;
      min-width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem 0;
    }

    .artist-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .artist-item {
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: background-color 0.2s;
      border-bottom: 1px solid var(--bs-border-color-translucent);
    }

    .artist-item:hover {
      background-color: var(--bs-tertiary-bg);
    }

    .artist-item.active {
      background-color: var(--bs-primary);
      color: white;
    }

    .artist-item.active:hover {
      background-color: var(--bs-primary);
      opacity: 0.9;
    }

    .artist-item-content {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .artist-info {
      flex: 1;
      min-width: 0;
    }

    .artist-name {
      font-size: 0.95rem;
      user-select: none;
      display: block;
    }

    .artist-progress {
      margin-top: 0.25rem;
    }

    .progress {
      height: 6px;
      width: 80%;
      background-color: var(--bs-secondary-bg);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-bar {
      background-color: var(--bs-primary);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.7rem;
      color: var(--bs-secondary);
      display: block;
      margin-top: 0.125rem;
    }

    .artist-item.active .progress-bar {
      background-color: white;
    }

    .artist-item.active .progress-text {
      color: rgba(255, 255, 255, 0.8);
    }
  `]
})
export class SidebarComponent implements OnInit {
  private musicService = inject(MusicService);
  private downloadsService = inject(DownloadsService);
  private cdr = inject(ChangeDetectorRef);
  
  @Input() selectedArtist: Artist | null = null;
  @Output() artistSelected = new EventEmitter<Artist | null>();
  @Output() addArtistClicked = new EventEmitter<void>();

  artists: Artist[] = [];
  loading = true;

  faPlus = faPlus;
  faUserCircle = faUserCircle;

  ngOnInit() {
    this.loadArtists();
    
    // Subscribe to artist changes
    this.musicService.artistsChanged.subscribe(artists => {
      this.artists = artists;
      this.loading = false;
    });

    // Subscribe to download updates to track progress
    this.downloadsService.updated.subscribe(() => {
      this.cdr.markForCheck();
    });
    this.downloadsService.queueChanged.subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  getArtistProgress(artistId: string): { percent: number; status: string } | null {
    // Find downloads for this artist by checking folder path
    let totalPercent = 0;
    let activeCount = 0;
    let status = '';

    for (const download of this.downloadsService.queue.values()) {
      if (download.folder && download.folder.startsWith(artistId + '/')) {
        activeCount++;
        const percent = download.percent || 0;
        totalPercent += percent;
        
        if (download.status === 'downloading') {
          status = 'Downloading...';
        } else if (download.status === 'preparing') {
          status = 'Preparing...';
        } else if (download.status === 'pending') {
          status = 'Queued';
        }
      }
    }

    if (activeCount === 0) {
      return null;
    }

    return {
      percent: totalPercent / activeCount,
      status: status || 'Processing...'
    };
  }

  loadArtists() {
    this.loading = true;
    this.musicService.getArtists().subscribe({
      next: (artists) => {
        this.artists = artists;
        this.musicService.artistsChanged.next(artists);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.loading = false;
      }
    });
  }

  selectArtist(artist: Artist) {
    this.artistSelected.emit(artist);
    this.musicService.artistSelected.next(artist);
  }

  onAddArtist() {
    this.addArtistClicked.emit();
  }
}
