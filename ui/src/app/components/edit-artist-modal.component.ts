import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MusicService } from '../services/music.service';

@Component({
  selector: 'app-edit-artist-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, FontAwesomeModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Rename Artist</h5>
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
        </div>
        @if (error) {
          <div class="alert alert-danger">{{ error }}</div>
        }
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()" [disabled]="submitting">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="!artistName.trim() || artistName.trim() === originalName || submitting">
            @if (submitting) {
              <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            }
            Save Changes
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
export class EditArtistModalComponent implements OnInit {
  @Input() originalName: string = '';

  activeModal = inject(NgbActiveModal);
  private musicService = inject(MusicService);

  artistName = '';
  submitting = false;
  error = '';

  ngOnInit() {
    this.artistName = this.originalName;
  }

  onSubmit() {
    if (!this.artistName.trim() || this.artistName.trim() === this.originalName) {
      return;
    }

    this.submitting = true;
    this.error = '';

    this.musicService.renameArtist(this.originalName, this.artistName.trim()).subscribe({
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
        this.error = error.error?.error || error.error?.msg || 'Failed to rename artist';
      }
    });
  }
}
