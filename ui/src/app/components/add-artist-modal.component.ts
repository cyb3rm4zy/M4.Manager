import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { MusicService } from '../services/music.service';

@Component({
  selector: 'app-add-artist-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, FontAwesomeModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Add New Artist</h5>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <form (ngSubmit)="onSubmit()">
        <div class="mb-3">
          <label for="artistName" class="form-label">Artist Name</label>
          <input 
            type="text" 
            class="form-control" 
            id="artistName"
            [(ngModel)]="artistName"
            name="artistName"
            placeholder="Enter artist name"
            required
            [disabled]="submitting"
            autofocus>
          <div class="form-text">This will create a new folder for the artist.</div>
        </div>
        @if (error) {
          <div class="alert alert-danger">{{ error }}</div>
        }
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()" [disabled]="submitting">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="!artistName.trim() || submitting">
            @if (submitting) {
              <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            }
            Create Artist
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .modal-footer {
      border-top: none;
      padding-top: 0;
    }
  `]
})
export class AddArtistModalComponent {
  activeModal = inject(NgbActiveModal);
  private musicService = inject(MusicService);

  artistName = '';
  submitting = false;
  error = '';

  faTimes = faTimes;

  onSubmit() {
    if (!this.artistName.trim()) {
      return;
    }

    this.submitting = true;
    this.error = '';

    this.musicService.createArtist(this.artistName.trim()).subscribe({
      next: (artist) => {
        this.submitting = false;
        this.activeModal.close(artist);
        // Reload artists list
        this.musicService.getArtists().subscribe(artists => {
          this.musicService.artistsChanged.next(artists);
        });
      },
      error: (error) => {
        this.submitting = false;
        this.error = error.error?.error || error.error?.msg || 'Failed to create artist';
      }
    });
  }
}
