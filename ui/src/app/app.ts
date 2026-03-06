import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CookieService } from 'ngx-cookie-service';
import { SidebarComponent } from './components/sidebar.component';
import { HomeComponent } from './components/home.component';
import { ArtistDetailComponent } from './components/artist-detail.component';
import { AddArtistModalComponent } from './components/add-artist-modal.component';
import { DownloadAlbumModalComponent } from './components/download-album-modal.component';
import { DownloadSingleModalComponent } from './components/download-single-modal.component';
import { AccentColorModalComponent } from './components/accent-color-modal.component';
import { MusicService, Artist } from './services/music.service';
import { DownloadsService } from './services/downloads.service';
import { Themes } from './theme';
import { Theme } from './interfaces';
import { faSun, faMoon, faCircleHalfStroke, faCheck, faMusic, faPalette } from '@fortawesome/free-solid-svg-icons';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FontAwesomeModule,
    NgbModule,
    SidebarComponent,
    HomeComponent,
    ArtistDetailComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.sass',
})
export class App implements OnInit {
  private cookieService = inject(CookieService);
  private musicService = inject(MusicService);
  private ngbModal = inject(NgbModal);
  private http = inject(HttpClient);
  downloads = inject(DownloadsService);

  selectedArtist: Artist | null = null;
  showHome = true;
  themes: Theme[] = Themes;
  activeTheme: Theme | undefined;

  faSun = faSun;
  faMoon = faMoon;
  faCircleHalfStroke = faCircleHalfStroke;
  faCheck = faCheck;
  faMusic = faMusic;
  faPalette = faPalette;

  constructor() {
    this.activeTheme = this.getPreferredTheme(this.cookieService);
  }

  ngOnInit() {
    this.setTheme(this.activeTheme!);
    this.loadAccentColor();

    this.musicService.artistSelected.subscribe(artist => {
      this.selectedArtist = artist;
      this.showHome = artist == null;
    });

    this.downloads.doneChanged.subscribe(() => {
      if (this.selectedArtist) {
        this.refreshArtistDetails();
      }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.activeTheme && this.activeTheme.id === 'auto') {
        this.setTheme(this.activeTheme);
      }
    });
  }

  loadAccentColor() {
    this.http.get<{ color: string }>('api/config/accent-color').subscribe({
      next: (response) => {
        if (response.color) {
          this.applyAccentColor(response.color);
        }
      },
      error: (error) => {
        console.error('Error loading accent color:', error);
        this.applyAccentColor('#0d6efd');
      }
    });
  }

  applyAccentColor(color: string) {
    document.documentElement.style.setProperty('--bs-primary', color);
    document.documentElement.style.setProperty('--bs-primary-rgb', this.hexToRgb(color));
    this.updateFavicon(color);
  }

  private getFaviconDataUrl(color: string): string {
    const path = 'M468 7c7.6 6.1 12 15.3 12 25l0 304c0 44.2-43 80-96 80s-96-35.8-96-80 43-80 96-80c11.2 0 22 1.6 32 4.6l0-116.7-224 49.8 0 206.3c0 44.2-43 80-96 80s-96-35.8-96-80 43-80 96-80c11.2 0 22 1.6 32 4.6L128 96c0-15 10.4-28 25.1-31.2l288-64c9.5-2.1 19.4 .2 27 6.3z';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="${color}" d="${path}"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  private updateFavicon(color: string) {
    const link = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
    if (link) {
      link.href = this.getFaviconDataUrl(color);
    }
  }

  hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '13, 110, 253';
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `${r}, ${g}, ${b}`;
  }

  onAccentColorClick() {
    const modalRef = this.ngbModal.open(AccentColorModalComponent);
    modalRef.result.then(
      (color) => {
        if (color) {
          this.applyAccentColor(color);
        }
      },
      () => {}
    );
  }

  getPreferredTheme(cookieService: CookieService) {
    let theme = 'auto';
    if (cookieService.check('metube_theme')) {
      theme = cookieService.get('metube_theme');
    }
    return this.themes.find(x => x.id === theme) ?? this.themes.find(x => x.id === 'auto');
  }

  themeChanged(theme: Theme) {
    this.cookieService.set('metube_theme', theme.id, { expires: 3650 });
    this.setTheme(theme);
  }

  setTheme(theme: Theme) {
    this.activeTheme = theme;
    if (theme.id === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-bs-theme', theme.id);
    }
  }

  onAddArtist() {
    const modalRef = this.ngbModal.open(AddArtistModalComponent);
    modalRef.result.then(
      (artist) => {
        if (artist) {
          this.selectedArtist = artist;
          this.showHome = false;
          this.musicService.artistSelected.next(artist);
        }
      },
      () => {}
    );
  }

  onArtistSelected(artist: Artist | null) {
    if (!artist) return;
    this.selectedArtist = artist;
    this.showHome = false;
    this.musicService.artistSelected.next(artist);
  }

  goHome() {
    this.showHome = true;
    this.selectedArtist = null;
    this.musicService.artistSelected.next(null);
  }

  onDownloadAlbum() {
    if (!this.selectedArtist) return;
    
    const modalRef = this.ngbModal.open(DownloadAlbumModalComponent);
    modalRef.componentInstance.artistId = this.selectedArtist.id;
    modalRef.result.then(
      () => {
        setTimeout(() => this.refreshArtistDetails(), 2000);
      },
      () => {}
    );
  }

  onDownloadSingle() {
    if (!this.selectedArtist) return;
    
    const modalRef = this.ngbModal.open(DownloadSingleModalComponent);
    modalRef.componentInstance.artistId = this.selectedArtist.id;
    modalRef.result.then(
      () => {
        setTimeout(() => this.refreshArtistDetails(), 2000);
      },
      () => {}
    );
  }

  refreshArtistDetails() {
    if (this.selectedArtist) {
      this.musicService.getArtistDetails(this.selectedArtist.id).subscribe({
        next: (artist) => {
          this.selectedArtist = artist;
        },
        error: (error) => {
          console.error('Error refreshing artist details:', error);
        }
      });
    }
  }
}
