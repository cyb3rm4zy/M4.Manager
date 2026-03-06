import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { 
  faDownload, 
  faMusic, 
  faFolder, 
  faTrashAlt,
  faPlus,
  faSpinner,
  faEdit
} from '@fortawesome/free-solid-svg-icons';
import { MusicService, Artist, Album, Single } from '../services/music.service';
import { DownloadsService } from '../services/downloads.service';
import { Download } from '../interfaces';
import { AlbumDetailComponent } from './album-detail.component';
import { EditArtistModalComponent } from './edit-artist-modal.component';
import { EditAlbumModalComponent } from './edit-album-modal.component';

@Component({
  selector: 'app-artist-detail',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, NgbModule, DecimalPipe, AlbumDetailComponent, EditArtistModalComponent, EditAlbumModalComponent],
  template: `
    <div class="artist-detail">
      @if (!artist) {
        <div class="empty-state">
          <fa-icon [icon]="faMusic" size="3x" class="text-muted mb-3" />
          <h4>Select an artist</h4>
          <p class="text-muted">Choose an artist from the sidebar to view their albums and singles.</p>
        </div>
      } @else {
        <div class="artist-header">
          <div class="artist-header-info">
            <div class="artist-name-row">
              <h2 class="artist-name">{{ artist.name }}</h2>
              <button 
                class="btn btn-link btn-sm edit-artist-btn"
                (click)="editArtist()"
                title="Rename artist">
                <fa-icon [icon]="faEdit" />
              </button>
            </div>
            @if (getArtistProgress()) {
              <div class="artist-progress-section">
                <div class="progress" style="height: 8px; width: 85%;">
                  <div 
                    class="progress-bar progress-bar-striped progress-bar-animated" 
                    role="progressbar"
                    [style.width.%]="getArtistProgress()?.percent || 0"
                    [attr.aria-valuenow]="getArtistProgress()?.percent || 0"
                    aria-valuemin="0"
                    aria-valuemax="100">
                  </div>
                </div>
                <div class="progress-info">
                  <small class="text-muted">{{ getArtistProgress()?.status || '' }}</small>
                  @if (getArtistProgress()?.percent) {
                    <small class="text-muted ms-2">{{ getArtistProgress()?.percent | number:'1.0-0' }}%</small>
                  }
                </div>
              </div>
            }
          </div>
          <div class="artist-actions">
            <button 
              class="btn btn-primary"
              (click)="onDownloadAlbum()"
              [disabled]="loading">
              <fa-icon [icon]="faDownload" class="me-2" />
              Download Album
            </button>
            <button 
              class="btn btn-outline-primary"
              (click)="onDownloadSingle()"
              [disabled]="loading">
              <fa-icon [icon]="faPlus" class="me-2" />
              Download Single
            </button>
            <button 
              class="btn btn-outline-danger ms-2"
              (click)="deleteArtist()"
              [disabled]="loading"
              title="Delete this artist and all their music">
              <fa-icon [icon]="faTrashAlt" class="me-2" />
              Delete artist
            </button>
          </div>
        </div>

        @if (loading) {
          <div class="text-center p-5">
            <fa-icon [icon]="faSpinner" size="2x" class="text-muted fa-spin" />
            <p class="mt-3 text-muted">Loading...</p>
          </div>
        } @else if (selectedAlbum) {
          <!-- Album Detail View (wrapper allows flex + scroll) -->
          <div class="artist-detail-body">
            <app-album-detail 
              [album]="selectedAlbum"
              (goBackEvent)="goBackToArtist()"
              (refreshRequested)="onAlbumContentChanged()">
            </app-album-detail>
          </div>
        } @else {
          <div class="artist-detail-scroll">
          <!-- Albums Section -->
          <div class="section">
            <h3 class="section-title">
              <fa-icon [icon]="faFolder" class="me-2" />
              Albums
            </h3>
            @if (albums.length === 0) {
              <div class="empty-section">
                <p class="text-muted">No albums yet.</p>
              </div>
            } @else {
              <div class="albums-grid">
                @for (album of albums; track album.id) {
                  <div class="album-card" (click)="viewAlbum(album)" (dblclick)="deleteAlbum(album)">
                    <div class="album-header">
                      <h5 class="album-name">{{ album.name }}</h5>
                      <div class="album-header-actions">
                        <button 
                          class="btn btn-sm btn-link p-0"
                          (click)="editAlbum(album); $event.stopPropagation()"
                          title="Rename album">
                          <fa-icon [icon]="faEdit" />
                        </button>
                        <button 
                          class="btn btn-sm btn-link text-danger p-0"
                          (click)="deleteAlbum(album); $event.stopPropagation()"
                          title="Delete album">
                          <fa-icon [icon]="faTrashAlt" />
                        </button>
                      </div>
                    </div>
                    <div class="album-info">
                      <small class="text-muted">
                        {{ album.track_count || 0 }} track{{ (album.track_count || 0) !== 1 ? 's' : '' }}
                      </small>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Singles Section -->
          <div class="section">
            <h3 class="section-title">
              <fa-icon [icon]="faMusic" class="me-2" />
              Singles
            </h3>
            @if (singles.length === 0) {
              <div class="empty-section">
                <p class="text-muted">No singles yet.</p>
              </div>
            } @else {
              <div class="singles-list">
                @for (single of singles; track single.id) {
                  <div class="single-item" (dblclick)="deleteSingle(single)">
                    <div class="single-info">
                      <div class="single-name">{{ getSingleDisplayName(single.name) }}</div>
                      @if (single.size) {
                        <small class="text-muted">{{ formatFileSize(single.size) }}</small>
                      }
                    </div>
                    <div class="single-actions">
                      <a 
                        [href]="getSingleDownloadUrl(single)"
                        [download]="single.name"
                        class="btn btn-sm btn-link"
                        title="Download single"
                        (click)="$event.stopPropagation()">
                        <fa-icon [icon]="faDownload" />
                      </a>
                      <button 
                        class="btn btn-sm btn-link text-danger p-0"
                        (click)="deleteSingle(single); $event.stopPropagation()"
                        title="Delete single">
                        <fa-icon [icon]="faTrashAlt" />
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .artist-detail {
      flex: 1;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background-color: var(--bs-body-bg);
      min-height: 0;
    }

    .artist-detail-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .artist-detail-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      text-align: center;
    }

    .artist-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--bs-border-color);
      flex-shrink: 0;
    }

    .artist-header-info {
      flex: 1;
    }

    .artist-name-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .artist-name {
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
      font-weight: 600;
    }

    .edit-artist-btn {
      padding: 0.25rem 0.5rem;
      color: var(--bs-secondary);
      text-decoration: none;
    }

    .edit-artist-btn:hover {
      color: var(--bs-primary);
    }

    .artist-progress-section {
      margin-top: 0.5rem;
    }

    .progress-info {
      display: flex;
      align-items: center;
      margin-top: 0.25rem;
    }

    .artist-actions {
      display: flex;
      gap: 0.5rem;
    }

    .section {
      margin-bottom: 3rem;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
    }

    .empty-section {
      padding: 2rem;
      text-align: center;
      background-color: var(--bs-secondary-bg);
      border-radius: 0.5rem;
    }

    .albums-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .album-card {
      background-color: var(--bs-secondary-bg);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.5rem;
      padding: 1rem;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }

    .album-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      border-color: var(--bs-primary);
    }

    .album-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .album-name {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      flex: 1;
    }

    .album-header-actions {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }

    .album-header-actions .btn-link {
      color: var(--bs-secondary);
    }

    .album-header-actions .btn-link:hover {
      color: var(--bs-primary);
    }

    .album-info {
      margin-top: 0.5rem;
    }

    .singles-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .single-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background-color: var(--bs-secondary-bg);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.375rem;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .single-item:hover {
      background-color: var(--bs-tertiary-bg);
    }

    .single-info {
      flex: 1;
      min-width: 0;
    }

    .single-name {
      font-size: 0.95rem;
      font-weight: 500;
      margin-bottom: 0.25rem;
      word-break: break-word;
    }

    .single-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
      align-items: center;
    }
  `]
})
export class ArtistDetailComponent implements OnInit, OnChanges {
  @Input() artist: Artist | null = null;

  private musicService = inject(MusicService);
  private downloadsService = inject(DownloadsService);
  private cdr = inject(ChangeDetectorRef);
  private ngbModal = inject(NgbModal);

  albums: Album[] = [];
  singles: Single[] = [];
  loading = false;
  selectedAlbum: Album | null = null;

  faDownload = faDownload;
  faMusic = faMusic;
  faFolder = faFolder;
  faTrashAlt = faTrashAlt;
  faPlus = faPlus;
  faSpinner = faSpinner;
  faEdit = faEdit;

  @Output() downloadAlbum = new EventEmitter<void>();
  @Output() downloadSingle = new EventEmitter<void>();

  ngOnInit() {
    // Subscribe to artist selection changes
    this.musicService.artistSelected.subscribe(artist => {
      if (artist) {
        this.loadArtistDetails(artist.id);
      }
    });

    // Subscribe to download updates to track progress
    this.downloadsService.updated.subscribe(() => {
      this.cdr.markForCheck();
    });
    this.downloadsService.queueChanged.subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  getArtistProgress(): { percent: number; status: string } | null {
    if (!this.artist) {
      return null;
    }

    // Find downloads for this artist by checking folder path
    let totalPercent = 0;
    let activeCount = 0;
    let status = '';

    for (const download of this.downloadsService.queue.values()) {
      if (download.folder && download.folder.startsWith(this.artist.id + '/')) {
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

  ngOnChanges(changes: SimpleChanges) {
    if (changes['artist'] && this.artist) {
      // Reset selected album when artist changes
      this.selectedAlbum = null;
      this.loadArtistDetails(this.artist.id);
    }
  }

  loadArtistDetails(artistId: string, selectAlbumId?: string) {
    this.loading = true;
    this.musicService.getArtistDetails(artistId).subscribe({
      next: (artist) => {
        this.albums = artist.albums || [];
        this.singles = artist.singles || [];
        if (selectAlbumId != null) {
          this.selectedAlbum = this.albums.find(a => a.id === selectAlbumId) ?? null;
        } else if (this.selectedAlbum) {
          const updatedAlbum = this.albums.find(a => a.id === this.selectedAlbum?.id);
          if (updatedAlbum) {
            this.selectedAlbum = updatedAlbum;
          } else {
            this.selectedAlbum = null;
          }
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading artist details:', error);
        this.loading = false;
      }
    });
  }

  onDownloadAlbum() {
    this.downloadAlbum.emit();
  }

  onDownloadSingle() {
    this.downloadSingle.emit();
  }

  deleteAlbum(album: Album) {
    if (confirm(`Delete album "${album.name}"? This will remove all tracks in the album.`)) {
      // TODO: Implement album deletion API endpoint
      console.log('Delete album:', album);
    }
  }

  deleteSingle(single: Single) {
    if (confirm(`Delete single "${single.name}"?`)) {
      // TODO: Implement single deletion API endpoint
      console.log('Delete single:', single);
    }
  }

  deleteArtist() {
    if (!this.artist) return;
    const message = `Delete artist "${this.artist.name}"? This will permanently remove their folder and all albums and singles. This cannot be undone.`;
    if (!confirm(message)) return;
    this.musicService.deleteArtist(this.artist.id).subscribe({
      next: () => {
        this.musicService.artistSelected.next(null);
        this.musicService.getArtists().subscribe(list => {
          this.musicService.artistsChanged.next(list);
        });
      },
      error: (err) => {
        console.error('Error deleting artist:', err);
        alert('Failed to delete artist. See console for details.');
      }
    });
  }

  viewAlbum(album: Album) {
    this.selectedAlbum = album;
  }

  goBackToArtist() {
    this.selectedAlbum = null;
  }

  editAlbum(album: Album) {
    if (!this.artist) return;
    const modalRef = this.ngbModal.open(EditAlbumModalComponent);
    modalRef.componentInstance.artistId = this.artist.id;
    modalRef.componentInstance.album = album;
    modalRef.result.then(
      (updated: Album) => {
        if (updated && this.artist) {
          this.loadArtistDetails(this.artist.id, updated.id);
        }
      },
      () => {}
    );
  }

  /** Called when album-detail changes (e.g. track deleted) so we refetch and keep UI in sync without showing loading spinner. */
  onAlbumContentChanged() {
    if (!this.artist) return;
    this.musicService.getArtistDetails(this.artist.id).subscribe({
      next: (artist) => {
        this.albums = artist.albums || [];
        this.singles = artist.singles || [];
        if (this.selectedAlbum) {
          const updatedAlbum = this.albums.find(a => a.id === this.selectedAlbum?.id);
          if (updatedAlbum) {
            this.selectedAlbum = updatedAlbum;
          } else {
            this.selectedAlbum = null;
          }
        }
      },
      error: (err) => console.error('Error refreshing artist details:', err)
    });
  }

  editArtist() {
    if (!this.artist) return;
    
    const modalRef = this.ngbModal.open(EditArtistModalComponent);
    modalRef.componentInstance.originalName = this.artist.name;
    modalRef.result.then(
      (updatedArtist) => {
        if (updatedArtist) {
          // Update the current artist and reload details
          this.artist = updatedArtist;
          this.musicService.artistSelected.next(updatedArtist);
          this.loadArtistDetails(updatedArtist.id);
        }
      },
      () => {
        // Modal dismissed
      }
    );
  }

  getSingleDisplayName(filename: string): string {
    // Remove file extension for display (same as album tracks)
    return filename.replace(/\.[^/.]+$/, '');
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getSingleDownloadUrl(single: Single): string {
    // Build download URL based on single path
    // The backend serves audio files from /audio_download/
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    // Encode the path properly for URL
    const encodedPath = single.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    return `${baseUrl}audio_download/${encodedPath}`;
  }
}
