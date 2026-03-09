#!/usr/bin/env python3
# pylint: disable=no-member,method-hidden

import os
import sys
import asyncio
from pathlib import Path
from aiohttp import web
from aiohttp.log import access_logger
import ssl
import socket
import socketio
import logging
import json
import pathlib
import re
import shutil
import subprocess
from watchfiles import DefaultFilter, Change, awatch

from ytdl import DownloadQueueNotifier, DownloadQueue
from yt_dlp.version import __version__ as yt_dlp_version

log = logging.getLogger('main')

def parseLogLevel(logLevel):
    match logLevel:
        case 'DEBUG':
            return logging.DEBUG
        case 'INFO':
            return logging.INFO
        case 'WARNING':
            return logging.WARNING
        case 'ERROR':
            return logging.ERROR
        case 'CRITICAL':
            return logging.CRITICAL
        case _:
            return None

if not logging.getLogger().hasHandlers():
    logging.basicConfig(level=parseLogLevel(os.environ.get('LOGLEVEL', 'INFO')) or logging.INFO)

class Config:
    _DEFAULTS = {
        'DOWNLOAD_DIR': '.',
        'AUDIO_DOWNLOAD_DIR': '%%DOWNLOAD_DIR',
        'TEMP_DIR': '%%DOWNLOAD_DIR',
        'DOWNLOAD_DIRS_INDEXABLE': 'false',
        'CUSTOM_DIRS': 'true',
        'CREATE_CUSTOM_DIRS': 'true',
        'CUSTOM_DIRS_EXCLUDE_REGEX': r'(^|/)[.@].*$',
        'DELETE_FILE_ON_TRASHCAN': 'false',
        'STATE_DIR': '.',
        'URL_PREFIX': '',
        'PUBLIC_HOST_URL': 'download/',
        'PUBLIC_HOST_AUDIO_URL': 'audio_download/',
        'OUTPUT_TEMPLATE': '%(title)s.%(ext)s',
        'OUTPUT_TEMPLATE_CHAPTER': '%(title)s - %(section_number)02d - %(section_title)s.%(ext)s',
        'OUTPUT_TEMPLATE_PLAYLIST': '%(playlist_title)s/%(title)s.%(ext)s',
        'OUTPUT_TEMPLATE_CHANNEL': '%(channel)s/%(title)s.%(ext)s',
        'DEFAULT_OPTION_PLAYLIST_ITEM_LIMIT' : '0',
        'YTDL_OPTIONS': '{}',
        'YTDL_OPTIONS_FILE': '',
        'ROBOTS_TXT': '',
        'HOST': '0.0.0.0',
        'PORT': '8081',
        'HTTPS': 'false',
        'CERTFILE': '',
        'KEYFILE': '',
        'BASE_DIR': '',
        'DEFAULT_THEME': 'auto',
        'MAX_CONCURRENT_DOWNLOADS': 3,
        'LOGLEVEL': 'INFO',
        'ENABLE_ACCESSLOG': 'false',
        'UPDATE_YTDL_TOKEN': '',
    }

    _BOOLEAN = ('DOWNLOAD_DIRS_INDEXABLE', 'CUSTOM_DIRS', 'CREATE_CUSTOM_DIRS', 'DELETE_FILE_ON_TRASHCAN', 'HTTPS', 'ENABLE_ACCESSLOG')

    def __init__(self):
        for k, v in self._DEFAULTS.items():
            setattr(self, k, os.environ.get(k, v))

        for k, v in self.__dict__.items():
            if isinstance(v, str) and v.startswith('%%'):
                setattr(self, k, getattr(self, v[2:]))
            if k in self._BOOLEAN:
                if v not in ('true', 'false', 'True', 'False', 'on', 'off', '1', '0'):
                    log.error(f'Environment variable "{k}" is set to a non-boolean value "{v}"')
                    sys.exit(1)
                setattr(self, k, v in ('true', 'True', 'on', '1'))

        if not self.URL_PREFIX.endswith('/'):
            self.URL_PREFIX += '/'

        if self.YTDL_OPTIONS_FILE and self.YTDL_OPTIONS_FILE.startswith('.'):
            self.YTDL_OPTIONS_FILE = str(Path(self.YTDL_OPTIONS_FILE).resolve())

        success,_ = self.load_ytdl_options()
        if not success:
            sys.exit(1)

    def load_ytdl_options(self) -> tuple[bool, str]:
        try:
            self.YTDL_OPTIONS = json.loads(os.environ.get('YTDL_OPTIONS', '{}'))
            assert isinstance(self.YTDL_OPTIONS, dict)
        except (json.decoder.JSONDecodeError, AssertionError):
            msg = 'Environment variable YTDL_OPTIONS is invalid'
            log.error(msg)
            return (False, msg)

        if not self.YTDL_OPTIONS_FILE:
            return (True, '')

        log.info(f'Loading yt-dlp custom options from "{self.YTDL_OPTIONS_FILE}"')
        if not os.path.exists(self.YTDL_OPTIONS_FILE):
            msg = f'File "{self.YTDL_OPTIONS_FILE}" not found'
            log.error(msg)
            return (False, msg)
        try:
            with open(self.YTDL_OPTIONS_FILE) as json_data:
                opts = json.load(json_data)
            assert isinstance(opts, dict)
        except (json.decoder.JSONDecodeError, AssertionError):
            msg = 'YTDL_OPTIONS_FILE contents is invalid'
            log.error(msg)
            return (False, msg)

        self.YTDL_OPTIONS.update(opts)
        return (True, '')

config = Config()
logging.getLogger().setLevel(parseLogLevel(str(config.LOGLEVEL)) or logging.INFO)

class ObjectSerializer(json.JSONEncoder):
    def default(self, obj):
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        elif hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes)):
            try:
                return list(obj)
            except:
                pass
        return json.JSONEncoder.default(self, obj)

serializer = ObjectSerializer()
app = web.Application()
sio = socketio.AsyncServer(cors_allowed_origins='*')
sio.attach(app, socketio_path=config.URL_PREFIX + 'socket.io')
routes = web.RouteTableDef()
VALID_SUBTITLE_FORMATS = {'srt', 'txt', 'vtt', 'ttml', 'sbv', 'scc', 'dfxp'}
VALID_SUBTITLE_MODES = {'auto_only', 'manual_only', 'prefer_manual', 'prefer_auto'}
SUBTITLE_LANGUAGE_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9-]{0,34}$')

class Notifier(DownloadQueueNotifier):
    async def added(self, dl):
        log.info(f"Notifier: Download added - {dl.title}")
        await sio.emit('added', serializer.encode(dl))

    async def updated(self, dl):
        log.debug(f"Notifier: Download updated - {dl.title}")
        await sio.emit('updated', serializer.encode(dl))

    async def completed(self, dl):
        log.info(f"Notifier: Download completed - {dl.title}")
        await sio.emit('completed', serializer.encode(dl))

    async def canceled(self, id):
        log.info(f"Notifier: Download canceled - {id}")
        await sio.emit('canceled', serializer.encode(id))

    async def cleared(self, id):
        log.info(f"Notifier: Download cleared - {id}")
        await sio.emit('cleared', serializer.encode(id))

dqueue = DownloadQueue(config, Notifier())
app.on_startup.append(lambda app: dqueue.initialize())

class FileOpsFilter(DefaultFilter):
    def __call__(self, change_type: int, path: str) -> bool:
        if path != config.YTDL_OPTIONS_FILE:
            return False

        if os.path.exists(config.YTDL_OPTIONS_FILE):
            try:
                if not os.path.samefile(path, config.YTDL_OPTIONS_FILE):
                    return False
            except (OSError, IOError):
                if path != config.YTDL_OPTIONS_FILE:
                    return False

        return change_type in (Change.modified, Change.added, Change.deleted)

def get_options_update_time(success=True, msg=''):
    result = {
        'success': success,
        'msg': msg,
        'update_time': None
    }

    if config.YTDL_OPTIONS_FILE and os.path.exists(config.YTDL_OPTIONS_FILE):
        try:
            result['update_time'] = os.path.getmtime(config.YTDL_OPTIONS_FILE)
        except (OSError, IOError) as e:
            log.warning(f"Could not get modification time for {config.YTDL_OPTIONS_FILE}: {e}")
            result['update_time'] = None

    return result

async def watch_files():
    async def _watch_files():
        async for changes in awatch(config.YTDL_OPTIONS_FILE, watch_filter=FileOpsFilter()):
            success, msg = config.load_ytdl_options()
            result = get_options_update_time(success, msg)
            await sio.emit('ytdl_options_changed', serializer.encode(result))

    log.info(f'Starting Watch File: {config.YTDL_OPTIONS_FILE}')
    asyncio.create_task(_watch_files())

if config.YTDL_OPTIONS_FILE:
    app.on_startup.append(lambda app: watch_files())

@routes.post(config.URL_PREFIX + 'add')
async def add(request):
    log.info("Received request to add download")
    post = await request.json()
    log.info(f"Request data: {post}")
    url = post.get('url')
    quality = post.get('quality')
    if not url or not quality:
        log.error("Bad request: missing 'url' or 'quality'")
        raise web.HTTPBadRequest()
    format = post.get('format')
    folder = post.get('folder')
    custom_name_prefix = post.get('custom_name_prefix')
    playlist_item_limit = post.get('playlist_item_limit')
    auto_start = post.get('auto_start')
    split_by_chapters = post.get('split_by_chapters')
    chapter_template = post.get('chapter_template')
    subtitle_format = post.get('subtitle_format')
    subtitle_language = post.get('subtitle_language')
    subtitle_mode = post.get('subtitle_mode')

    if custom_name_prefix is None:
        custom_name_prefix = ''
    if custom_name_prefix and ('..' in custom_name_prefix or custom_name_prefix.startswith('/') or custom_name_prefix.startswith('\\')):
        raise web.HTTPBadRequest(reason='custom_name_prefix must not contain ".." or start with a path separator')
    if auto_start is None:
        auto_start = True
    if playlist_item_limit is None:
        playlist_item_limit = config.DEFAULT_OPTION_PLAYLIST_ITEM_LIMIT
    if split_by_chapters is None:
        split_by_chapters = False
    if chapter_template is None:
        chapter_template = config.OUTPUT_TEMPLATE_CHAPTER
    if subtitle_format is None:
        subtitle_format = 'srt'
    if subtitle_language is None:
        subtitle_language = 'en'
    if subtitle_mode is None:
        subtitle_mode = 'prefer_manual'
    subtitle_format = str(subtitle_format).strip().lower()
    subtitle_language = str(subtitle_language).strip()
    subtitle_mode = str(subtitle_mode).strip()
    if chapter_template and ('..' in chapter_template or chapter_template.startswith('/') or chapter_template.startswith('\\')):
        raise web.HTTPBadRequest(reason='chapter_template must not contain ".." or start with a path separator')
    if subtitle_format not in VALID_SUBTITLE_FORMATS:
        raise web.HTTPBadRequest(reason=f'subtitle_format must be one of {sorted(VALID_SUBTITLE_FORMATS)}')
    if not SUBTITLE_LANGUAGE_RE.fullmatch(subtitle_language):
        raise web.HTTPBadRequest(reason='subtitle_language must match pattern [A-Za-z0-9-] and be at most 35 characters')
    if subtitle_mode not in VALID_SUBTITLE_MODES:
        raise web.HTTPBadRequest(reason=f'subtitle_mode must be one of {sorted(VALID_SUBTITLE_MODES)}')

    playlist_item_limit = int(playlist_item_limit)

    status = await dqueue.add(
        url,
        quality,
        format,
        folder,
        custom_name_prefix,
        playlist_item_limit,
        auto_start,
        split_by_chapters,
        chapter_template,
        subtitle_format,
        subtitle_language,
        subtitle_mode,
    )
    return web.Response(text=serializer.encode(status))

@routes.post(config.URL_PREFIX + 'cancel-add')
async def cancel_add(request):
    dqueue.cancel_add()
    return web.Response(text=serializer.encode({'status': 'ok'}), content_type='application/json')

@routes.post(config.URL_PREFIX + 'delete')
async def delete(request):
    post = await request.json()
    ids = post.get('ids')
    where = post.get('where')
    if not ids or where not in ['queue', 'done']:
        log.error("Bad request: missing 'ids' or incorrect 'where' value")
        raise web.HTTPBadRequest()
    status = await (dqueue.cancel(ids) if where == 'queue' else dqueue.clear(ids))
    log.info(f"Download delete request processed for ids: {ids}, where: {where}")
    return web.Response(text=serializer.encode(status))

@routes.post(config.URL_PREFIX + 'start')
async def start(request):
    post = await request.json()
    ids = post.get('ids')
    log.info(f"Received request to start pending downloads for ids: {ids}")
    status = await dqueue.start_pending(ids)
    return web.Response(text=serializer.encode(status))

@routes.get(config.URL_PREFIX + 'history')
async def history(request):
    history = { 'done': [], 'queue': [], 'pending': []}

    for _, v in dqueue.queue.saved_items():
        history['queue'].append(v)
    for _, v in dqueue.done.saved_items():
        history['done'].append(v)
    for _, v in dqueue.pending.saved_items():
        history['pending'].append(v)

    log.info("Sending download history")
    return web.Response(text=serializer.encode(history))

@sio.event
async def connect(sid, environ):
    log.info(f"Client connected: {sid}")
    await sio.emit('all', serializer.encode(dqueue.get()), to=sid)
    await sio.emit('configuration', serializer.encode(config), to=sid)
    if config.CUSTOM_DIRS:
        await sio.emit('custom_dirs', serializer.encode(get_custom_dirs()), to=sid)
    if config.YTDL_OPTIONS_FILE:
        await sio.emit('ytdl_options_changed', serializer.encode(get_options_update_time()), to=sid)

def get_custom_dirs():
    def recursive_dirs(base):
        path = pathlib.Path(base)

        def convert(p):
            s = str(p)
            if s.startswith(base):
                s = s[len(base):]

            if s.startswith('/'):
                s = s[1:]

            return s

        def include_dir(d):
            if len(config.CUSTOM_DIRS_EXCLUDE_REGEX) == 0:
                return True
            else:
                return re.search(config.CUSTOM_DIRS_EXCLUDE_REGEX, d) is None

        dirs = list(filter(include_dir, map(convert, path.glob('**/'))))

        return dirs

    download_dir = recursive_dirs(config.DOWNLOAD_DIR)

    audio_download_dir = download_dir
    if config.DOWNLOAD_DIR != config.AUDIO_DOWNLOAD_DIR:
        audio_download_dir = recursive_dirs(config.AUDIO_DOWNLOAD_DIR)

    return {
        "download_dir": download_dir,
        "audio_download_dir": audio_download_dir
    }

@routes.get(config.URL_PREFIX)
def index(request):
    response = web.FileResponse(os.path.join(config.BASE_DIR, 'ui/dist/metube/browser/index.html'))
    if 'metube_theme' not in request.cookies:
        response.set_cookie('metube_theme', config.DEFAULT_THEME)
    return response

@routes.get(config.URL_PREFIX + 'robots.txt')
def robots(request):
    if config.ROBOTS_TXT:
        response = web.FileResponse(os.path.join(config.BASE_DIR, config.ROBOTS_TXT))
    else:
        response = web.Response(
            text="User-agent: *\nDisallow: /download/\nDisallow: /audio_download/\n"
        )
    return response

@routes.get(config.URL_PREFIX + 'version')
def version(request):
    return web.json_response({
        "yt-dlp": yt_dlp_version,
        "version": os.getenv("METUBE_VERSION", "dev")
    })

if config.URL_PREFIX != '/':
    @routes.get('/')
    def index_redirect_root(request):
        return web.HTTPFound(config.URL_PREFIX)

    @routes.get(config.URL_PREFIX[:-1])
    def index_redirect_dir(request):
        return web.HTTPFound(config.URL_PREFIX)

def sanitize_folder_name(name: str) -> str:
    """Sanitize folder name to prevent path traversal and invalid characters."""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)
    name = name.strip(' .')
    name = re.sub(r'\s+', ' ', name)
    return name

def get_music_base_dir():
    """Get the base music directory (DOWNLOAD_DIR)."""
    return os.path.realpath(config.DOWNLOAD_DIR)

def get_artist_dir(artist_name: str):
    """Get the full path for an artist directory."""
    base = get_music_base_dir()
    safe_name = sanitize_folder_name(artist_name)
    return os.path.join(base, safe_name)

def get_album_dir(artist_name: str, album_name: str):
    """Get the full path for an album directory."""
    artist_path = get_artist_dir(artist_name)
    safe_album = sanitize_folder_name(album_name)
    return os.path.join(artist_path, safe_album)

def get_singles_dir(artist_name: str):
    """Get the full path for the singles directory of an artist."""
    artist_path = get_artist_dir(artist_name)
    return os.path.join(artist_path, 'Singles')

def _count_artist_mp3_stats(artist_path: str):
    """Return (file_count, total_size_bytes) for .mp3 files under artist_path.
    Uses the same structure as get_artist_details: Singles + album dirs. No os.walk.
    """
    count = 0
    total = 0
    try:
        if not os.path.isdir(artist_path):
            return 0, 0
        for item in os.listdir(artist_path):
            if item.startswith('.') or item == '.metube':
                continue
            item_path = os.path.join(artist_path, item)
            if not os.path.isdir(item_path):
                continue
            if item == 'Singles':
                if os.path.exists(item_path):
                    for fname in os.listdir(item_path):
                        if fname.lower().endswith('.mp3'):
                            try:
                                full = os.path.join(item_path, fname)
                                if os.path.isfile(full):
                                    total += os.path.getsize(full)
                                    count += 1
                            except OSError:
                                pass
            else:
                for fname in os.listdir(item_path):
                    if fname.lower().endswith('.mp3'):
                        try:
                            full = os.path.join(item_path, fname)
                            if os.path.isfile(full):
                                total += os.path.getsize(full)
                                count += 1
                        except OSError:
                            pass
    except OSError as e:
        log.debug("_count_artist_mp3_stats OSError for %r: %s", artist_path, e)
    return count, total

@routes.get(config.URL_PREFIX + 'api/artists')
async def list_artists(request):
    """List all artists (folders in music directory) with mp3 file count and total size."""
    base = get_music_base_dir()
    try:
        if not os.path.exists(base):
            os.makedirs(base, exist_ok=True)
        artists = []
        for item in os.listdir(base):
            if item.startswith('.') or item == '.metube':
                continue
            item_path = os.path.join(base, item)
            if os.path.isdir(item_path):
                file_count, total_size = _count_artist_mp3_stats(item_path)
                try:
                    modified_at = os.path.getmtime(item_path)
                except OSError:
                    modified_at = 0
                artists.append({
                    'id': item,
                    'name': item,
                    'path': item,
                    'file_count': file_count,
                    'total_size': total_size,
                    'modified_at': modified_at
                })
        artists.sort(key=lambda x: x['name'].lower())
        return web.json_response(artists)
    except Exception as e:
        log.error(f"Error listing artists: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.post(config.URL_PREFIX + 'api/artists')
async def create_artist(request):
    """Create a new artist folder."""
    try:
        post = await request.json()
        artist_name = post.get('name', '').strip()
        if not artist_name:
            raise web.HTTPBadRequest(reason='Artist name is required')
        
        safe_name = sanitize_folder_name(artist_name)
        if not safe_name:
            raise web.HTTPBadRequest(reason='Invalid artist name')
        
        artist_path = get_artist_dir(safe_name)
        
        if os.path.exists(artist_path):
            return web.json_response({
                'id': safe_name,
                'name': safe_name,
                'path': safe_name,
                'message': 'Artist already exists'
            })
        
        os.makedirs(artist_path, exist_ok=True)
        log.info(f"Created artist folder: {artist_path}")
        
        return web.json_response({
            'id': safe_name,
            'name': safe_name,
            'path': safe_name
        })
    except web.HTTPBadRequest:
        raise
    except Exception as e:
        log.error(f"Error creating artist: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.put(config.URL_PREFIX + 'api/artists/{artist_id}')
async def rename_artist(request):
    """Rename an artist folder."""
    try:
        artist_id = request.match_info['artist_id']
        post = await request.json()
        new_name = post.get('name', '').strip()
        
        if not new_name:
            raise web.HTTPBadRequest(reason='Artist name is required')
        
        safe_new_name = sanitize_folder_name(new_name)
        if not safe_new_name:
            raise web.HTTPBadRequest(reason='Invalid artist name')
        
        old_artist_path = get_artist_dir(artist_id)
        new_artist_path = get_artist_dir(safe_new_name)
        
        base = get_music_base_dir()
        real_old_path = os.path.realpath(old_artist_path)
        real_new_path = os.path.realpath(new_artist_path)
        if not real_old_path.startswith(base) or not real_new_path.startswith(base):
            raise web.HTTPBadRequest(reason='Invalid artist path')
        
        if not os.path.exists(old_artist_path):
            raise web.HTTPNotFound(reason='Artist not found')
        
        if os.path.exists(new_artist_path) and old_artist_path != new_artist_path:
            raise web.HTTPBadRequest(reason='An artist with this name already exists')
        
        if old_artist_path != new_artist_path:
            os.rename(old_artist_path, new_artist_path)
            log.info(f"Renamed artist folder from {old_artist_path} to {new_artist_path}")
        
        return web.json_response({
            'id': safe_new_name,
            'name': safe_new_name,
            'path': safe_new_name
        })
    except web.HTTPBadRequest:
        raise
    except web.HTTPNotFound:
        raise
    except Exception as e:
        log.error(f"Error renaming artist: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.put(config.URL_PREFIX + 'api/artists/{artist_id}/albums/{album_id}')
async def rename_album(request):
    """Rename an album folder."""
    try:
        artist_id = request.match_info['artist_id']
        album_id = request.match_info['album_id']
        post = await request.json()
        new_name = post.get('name', '').strip()

        if not new_name:
            raise web.HTTPBadRequest(reason='Album name is required')

        safe_new_name = sanitize_folder_name(new_name)
        if not safe_new_name:
            raise web.HTTPBadRequest(reason='Invalid album name')

        old_album_path = get_album_dir(artist_id, album_id)
        new_album_path = get_album_dir(artist_id, safe_new_name)

        base = get_music_base_dir()
        real_old = os.path.realpath(old_album_path)
        real_new = os.path.realpath(new_album_path)
        if not real_old.startswith(base) or not real_new.startswith(base):
            raise web.HTTPBadRequest(reason='Invalid album path')

        if not os.path.exists(old_album_path):
            raise web.HTTPNotFound(reason='Album not found')

        if os.path.exists(new_album_path) and old_album_path != new_album_path:
            raise web.HTTPBadRequest(reason='An album with this name already exists')

        if old_album_path != new_album_path:
            os.rename(old_album_path, new_album_path)
            log.info(f"Renamed album from {old_album_path} to {new_album_path}")

        return web.json_response({
            'id': safe_new_name,
            'name': safe_new_name,
            'path': f"{artist_id}/{safe_new_name}"
        })
    except web.HTTPBadRequest:
        raise
    except web.HTTPNotFound:
        raise
    except Exception as e:
        log.error(f"Error renaming album: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.delete(config.URL_PREFIX + 'api/artists/{artist_id}')
async def delete_artist(request):
    """Delete an artist folder."""
    try:
        artist_id = request.match_info['artist_id']
        artist_path = get_artist_dir(artist_id)
        
        base = get_music_base_dir()
        real_artist_path = os.path.realpath(artist_path)
        if not real_artist_path.startswith(base):
            raise web.HTTPBadRequest(reason='Invalid artist path')
        
        if not os.path.exists(artist_path):
            raise web.HTTPNotFound(reason='Artist not found')
        
        shutil.rmtree(artist_path)
        log.info(f"Deleted artist folder: {artist_path}")
        
        return web.json_response({'status': 'ok'})
    except web.HTTPBadRequest:
        raise
    except web.HTTPNotFound:
        raise
    except Exception as e:
        log.error(f"Error deleting artist: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.delete(config.URL_PREFIX + 'api/artists/{artist_id}/albums/{album_id}/tracks/{track_id}')
async def delete_track(request):
    """Delete a track file from an album."""
    try:
        artist_id = request.match_info['artist_id']
        album_id = request.match_info['album_id']
        track_id = request.match_info['track_id']
        
        album_path = get_album_dir(artist_id, album_id)
        track_path = os.path.join(album_path, track_id)
        
        base = get_music_base_dir()
        real_track_path = os.path.realpath(track_path)
        if not real_track_path.startswith(base):
            raise web.HTTPBadRequest(reason='Invalid track path')
        
        if not os.path.exists(track_path):
            raise web.HTTPNotFound(reason='Track not found')
        
        if not os.path.isfile(track_path):
            raise web.HTTPBadRequest(reason='Path is not a file')
        
        os.remove(track_path)
        log.info(f"Deleted track file: {track_path}")
        
        return web.json_response({'status': 'ok'})
    except web.HTTPBadRequest:
        raise
    except web.HTTPNotFound:
        raise
    except Exception as e:
        log.error(f"Error deleting track: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.get(config.URL_PREFIX + 'api/artists/{artist_id}')
async def get_artist_details(request):
    """Get artist details including albums and singles."""
    try:
        artist_id = request.match_info['artist_id']
        artist_path = get_artist_dir(artist_id)
        
        base = get_music_base_dir()
        real_artist_path = os.path.realpath(artist_path)
        if not real_artist_path.startswith(base):
            raise web.HTTPBadRequest(reason='Invalid artist path')
        
        if not os.path.exists(artist_path):
            raise web.HTTPNotFound(reason='Artist not found')
        
        albums = []
        singles_dir = get_singles_dir(artist_id)
        singles = []
        
        for item in os.listdir(artist_path):
            if item.startswith('.') or item == '.metube':
                continue
            item_path = os.path.join(artist_path, item)
            if os.path.isdir(item_path):
                if item == 'Singles':
                    if os.path.exists(singles_dir):
                        for single_file in os.listdir(singles_dir):
                            if not single_file.lower().endswith('.mp3'):
                                continue
                            single_path = os.path.join(singles_dir, single_file)
                            if os.path.isfile(single_path):
                                file_size = os.path.getsize(single_path)
                                singles.append({
                                    'id': single_file,
                                    'name': single_file,
                                    'path': f"{artist_id}/Singles/{single_file}",
                                    'size': file_size
                                })
                else:
                    tracks = []
                    for album_item in os.listdir(item_path):
                        if not album_item.lower().endswith('.mp3'):
                            continue
                        album_item_path = os.path.join(item_path, album_item)
                        if os.path.isfile(album_item_path):
                            file_size = os.path.getsize(album_item_path)
                            tracks.append({
                                'id': album_item,
                                'name': album_item,
                                'path': f"{artist_id}/{item}/{album_item}",
                                'size': file_size
                            })
                    
                    albums.append({
                        'id': item,
                        'name': item,
                        'path': f"{artist_id}/{item}",
                        'track_count': len(tracks),
                        'tracks': tracks
                    })
        
        albums.sort(key=lambda x: x['name'].lower())
        singles.sort(key=lambda x: x['name'].lower())
        
        return web.json_response({
            'id': artist_id,
            'name': artist_id,
            'albums': albums,
            'singles': singles
        })
    except web.HTTPBadRequest:
        raise
    except web.HTTPNotFound:
        raise
    except Exception as e:
        log.error(f"Error getting artist details: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.post(config.URL_PREFIX + 'api/download/album')
async def download_album(request):
    """Download a playlist as an album."""
    try:
        post = await request.json()
        artist_id = post.get('artist_id', '').strip()
        album_name = post.get('album_name', '').strip()
        playlist_url = post.get('playlist_url', '').strip()
        
        if not artist_id or not album_name or not playlist_url:
            raise web.HTTPBadRequest(reason='artist_id, album_name, and playlist_url are required')
        
        album_dir_path = get_album_dir(artist_id, album_name)
        relative_folder = f"{artist_id}/{sanitize_folder_name(album_name)}"
        
        artist_path = get_artist_dir(artist_id)
        if not os.path.exists(artist_path):
            os.makedirs(artist_path, exist_ok=True)
        
        os.makedirs(album_dir_path, exist_ok=True)
        
        status = await dqueue.add(
            playlist_url,
            'audio',
            'mp3',
            relative_folder,
            '',
            0,
            True,
            False,
            config.OUTPUT_TEMPLATE_CHAPTER,
            'srt',
            'en',
            'prefer_manual'
        )
        
        return web.json_response(status)
    except web.HTTPBadRequest:
        raise
    except Exception as e:
        log.error(f"Error downloading album: {e}")
        return web.json_response({'status': 'error', 'msg': str(e)}, status=500)

@routes.post(config.URL_PREFIX + 'api/download/single')
async def download_single(request):
    """Download a single track."""
    try:
        post = await request.json()
        artist_id = post.get('artist_id', '').strip()
        video_url = post.get('video_url', '').strip()
        
        if not artist_id or not video_url:
            raise web.HTTPBadRequest(reason='artist_id and video_url are required')
        
        singles_dir_path = get_singles_dir(artist_id)
        relative_folder = f"{artist_id}/Singles"
        
        artist_path = get_artist_dir(artist_id)
        if not os.path.exists(artist_path):
            os.makedirs(artist_path, exist_ok=True)
        
        os.makedirs(singles_dir_path, exist_ok=True)
        
        status = await dqueue.add(
            video_url,
            'audio',
            'mp3',
            relative_folder,
            '',
            0,
            True,
            False,
            config.OUTPUT_TEMPLATE_CHAPTER,
            'srt',
            'en',
            'prefer_manual'
        )
        
        return web.json_response(status)
    except web.HTTPBadRequest:
        raise
    except Exception as e:
        log.error(f"Error downloading single: {e}")
        return web.json_response({'status': 'error', 'msg': str(e)}, status=500)

@routes.get(config.URL_PREFIX + 'api/config/accent-color')
async def get_accent_color(request):
    """Get the current accent color from config file."""
    try:
        config_file = os.path.join(config.STATE_DIR, 'accent-color.json')
        default_color = '#0d6efd'
        
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    data = json.load(f)
                    color = data.get('color', default_color)
                    return web.json_response({'color': color})
            except (json.JSONDecodeError, IOError) as e:
                log.warning(f"Error reading accent color config: {e}")
        
        return web.json_response({'color': default_color})
    except Exception as e:
        log.error(f"Error getting accent color: {e}")
        return web.json_response({'color': '#0d6efd'})

@routes.put(config.URL_PREFIX + 'api/config/accent-color')
async def set_accent_color(request):
    """Set the accent color and save to config file."""
    try:
        post = await request.json()
        color = post.get('color', '').strip()
        
        if not color or not re.match(r'^#[0-9A-Fa-f]{6}$', color):
            raise web.HTTPBadRequest(reason='Invalid color format. Must be a hex color (e.g., #0d6efd)')
        
        os.makedirs(config.STATE_DIR, exist_ok=True)
        
        config_file = os.path.join(config.STATE_DIR, 'accent-color.json')
        with open(config_file, 'w') as f:
            json.dump({'color': color}, f)
        
        log.info(f"Accent color set to: {color}")
        return web.json_response({'color': color})
    except web.HTTPBadRequest:
        raise
    except Exception as e:
        log.error(f"Error setting accent color: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.get(config.URL_PREFIX + 'api/file-tree')
async def get_file_tree(request):
    """Get the entire file structure of the music directory."""
    try:
        base = get_music_base_dir()
        if not os.path.exists(base):
            os.makedirs(base, exist_ok=True)
            return web.json_response({'artists': []})
        
        artists = []
        for artist_name in os.listdir(base):
            if artist_name.startswith('.') or artist_name == '.metube':
                continue
            artist_path = os.path.join(base, artist_name)
            if os.path.isdir(artist_path):
                artist_data = {
                    'id': artist_name,
                    'name': artist_name,
                    'albums': [],
                    'singles': []
                }
                
                for item in os.listdir(artist_path):
                    if item.startswith('.') or item == '.metube':
                        continue
                    item_path = os.path.join(artist_path, item)
                    if os.path.isdir(item_path):
                        if item == 'Singles':
                            for single_file in os.listdir(item_path):
                                if not single_file.lower().endswith('.mp3'):
                                    continue
                                single_file_path = os.path.join(item_path, single_file)
                                if os.path.isfile(single_file_path):
                                    file_size = os.path.getsize(single_file_path)
                                    artist_data['singles'].append({
                                        'id': single_file,
                                        'name': single_file,
                                        'path': f"{artist_name}/Singles/{single_file}",
                                        'size': file_size
                                    })
                        else:
                            tracks = []
                            for track_file in os.listdir(item_path):
                                if not track_file.lower().endswith('.mp3'):
                                    continue
                                track_file_path = os.path.join(item_path, track_file)
                                if os.path.isfile(track_file_path):
                                    tracks.append({
                                        'id': track_file,
                                        'name': track_file,
                                        'path': f"{artist_name}/{item}/{track_file}"
                                    })
                            
                            artist_data['albums'].append({
                                'id': item,
                                'name': item,
                                'path': f"{artist_name}/{item}",
                                'tracks': tracks
                            })
                
                artist_data['albums'].sort(key=lambda x: x['name'].lower())
                artist_data['singles'].sort(key=lambda x: x['name'].lower())
                artists.append(artist_data)
        
        artists.sort(key=lambda x: x['name'].lower())
        return web.json_response({'artists': artists})
    except Exception as e:
        log.error(f"Error getting file tree: {e}")
        return web.json_response({'error': str(e)}, status=500)

async def _update_yt_dlp_and_restart():
    def _run_update():
        try:
            log.info("Updating yt-dlp via pip")
            subprocess.run([sys.executable, "-m", "pip", "install", "-U", "yt-dlp"], check=True)
        except Exception as e:
            log.error(f"Error updating yt-dlp: {e}")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _run_update)
    log.info("Restarting process after yt-dlp update")
    os._exit(0)

@routes.post(config.URL_PREFIX + 'api/admin/update-yt-dlp')
async def update_yt_dlp(request):
    token = getattr(config, 'UPDATE_YTDL_TOKEN', '')
    if token:
        provided = request.headers.get('X-Admin-Token', '')
        if not provided and request.can_read_body:
            try:
                data = await request.json()
                provided = str(data.get('token', ''))
            except Exception:
                provided = ''
        if provided != token:
            raise web.HTTPForbidden(reason='Invalid admin token')

    asyncio.create_task(_update_yt_dlp_and_restart())
    return web.json_response({'status': 'updating', 'message': 'yt-dlp update started; server will restart shortly'})


routes.static(config.URL_PREFIX + 'download/', config.DOWNLOAD_DIR, show_index=config.DOWNLOAD_DIRS_INDEXABLE)
routes.static(config.URL_PREFIX + 'audio_download/', config.AUDIO_DOWNLOAD_DIR, show_index=config.DOWNLOAD_DIRS_INDEXABLE)
routes.static(config.URL_PREFIX, os.path.join(config.BASE_DIR, 'ui/dist/metube/browser'))
try:
    app.add_routes(routes)
except ValueError as e:
    if 'ui/dist/metube/browser' in str(e):
        raise RuntimeError('Could not find the frontend UI static assets. Please run `node_modules/.bin/ng build` inside the ui folder') from e
    raise e

async def add_cors(request):
    return web.Response(text=serializer.encode({"status": "ok"}))

app.router.add_route('OPTIONS', config.URL_PREFIX + 'add', add_cors)
app.router.add_route('OPTIONS', config.URL_PREFIX + 'cancel-add', add_cors)

async def on_prepare(request, response):
    if 'Origin' in request.headers:
        response.headers['Access-Control-Allow-Origin'] = request.headers['Origin']
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'

app.on_response_prepare.append(on_prepare)

def supports_reuse_port():
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        sock.close()
        return True
    except (AttributeError, OSError):
        return False

def isAccessLogEnabled():
    if config.ENABLE_ACCESSLOG:
        return access_logger
    else:
        return None

if __name__ == '__main__':
    logging.getLogger().setLevel(parseLogLevel(config.LOGLEVEL) or logging.INFO)
    log.info(f"Listening on {config.HOST}:{config.PORT}")

    if config.HTTPS:
        ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ssl_context.load_cert_chain(certfile=config.CERTFILE, keyfile=config.KEYFILE)
        web.run_app(app, host=config.HOST, port=int(config.PORT), reuse_port=supports_reuse_port(), ssl_context=ssl_context, access_log=isAccessLogEnabled())
    else:
        web.run_app(app, host=config.HOST, port=int(config.PORT), reuse_port=supports_reuse_port(), access_log=isAccessLogEnabled())
