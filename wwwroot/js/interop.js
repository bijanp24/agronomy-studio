window.agronomyMap = (function () {
    let map = null;
    let polygons = [];
    let markerList = [];
    let heatmapLayer = null;
    let infoWindow = null;
    let dotNetHelper = null;

    // -------------------------------------------------------------------------
    // Color ramps
    // -------------------------------------------------------------------------

    /** Interpolate between two hex colors. t in [0, 1]. */
    function lerpColor(hex1, hex2, t) {
        const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
        const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
        const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
        const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
        const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    /** Map a [0,1] value through a multi-stop ramp (stops: [{t, hex}]). */
    function rampColor(stops, value) {
        const v = Math.max(0, Math.min(1, value));
        for (let i = 1; i < stops.length; i++) {
            if (v <= stops[i].t) {
                const range = stops[i].t - stops[i - 1].t;
                const t = range === 0 ? 0 : (v - stops[i - 1].t) / range;
                return lerpColor(stops[i - 1].hex, stops[i].hex, t);
            }
        }
        return stops[stops.length - 1].hex;
    }

    // Pre-defined ramps
    const RAMPS = {
        // Vegetation: red (stress) → yellow → green (vigour)
        vegetation: [
            { t: 0.0, hex: '#b91c1c' },
            { t: 0.3, hex: '#dc2626' },
            { t: 0.5, hex: '#eab308' },
            { t: 0.7, hex: '#84cc16' },
            { t: 1.0, hex: '#15803d' },
        ],
        // GDD: blue (cold/low) → amber → orange (hot/high)
        gdd: [
            { t: 0.0, hex: '#1d4ed8' },
            { t: 0.4, hex: '#06b6d4' },
            { t: 0.7, hex: '#f59e0b' },
            { t: 1.0, hex: '#ea580c' },
        ],
        // ET: light blue (low demand) → teal → purple (high demand)
        et: [
            { t: 0.0, hex: '#bfdbfe' },
            { t: 0.5, hex: '#0891b2' },
            { t: 1.0, hex: '#7e22ce' },
        ],
        // Frost risk: green (safe) → yellow → blue-white (high risk)
        frost: [
            { t: 0.0, hex: '#16a34a' },
            { t: 0.4, hex: '#fbbf24' },
            { t: 0.7, hex: '#60a5fa' },
            { t: 1.0, hex: '#e0e7ef' },
        ],
        // Soil moisture deficit: blue (wet) → yellow → red (dry/critical)
        moisture: [
            { t: 0.0, hex: '#1d4ed8' },
            { t: 0.4, hex: '#22d3ee' },
            { t: 0.6, hex: '#fbbf24' },
            { t: 1.0, hex: '#dc2626' },
        ],
        // Elevation heatmap (original)
        elevation: [
            { t: 0.0, hex: '#1e3a5f' },
            { t: 0.5, hex: '#f59e0b' },
            { t: 1.0, hex: '#dc2626' },
        ],
    };

    // -------------------------------------------------------------------------
    // Google Maps loading
    // -------------------------------------------------------------------------

    function fail(message) { return { ok: false, message }; }

    function loadGoogleMaps(apiKey) {
        if (!apiKey) {
            return Promise.reject(new Error(
                'Google Maps API key is missing. Set GoogleMaps:ApiKey in appsettings.Development.json for local dev, or GOOGLE_MAPS_API_KEY in Netlify / GitHub Actions for production.'
            ));
        }
        if (window._googleMapsPromise) return window._googleMapsPromise;
        window._googleMapsPromise = new Promise((resolve, reject) => {
            if (window.google && window.google.maps) { resolve(); return; }
            const callbackName = '_initGoogleMaps';
            let settled = false;
            const finish = (error) => {
                if (settled) return;
                settled = true;
                delete window[callbackName];
                if (error) { window._googleMapsPromise = null; reject(error); return; }
                resolve();
            };
            window[callbackName] = () => finish(null);
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=visualization&loading=async&callback=${callbackName}`;
            script.async = true;
            script.onerror = () => finish(new Error('Failed to download the Google Maps JavaScript API.'));
            document.head.appendChild(script);
        });
        return window._googleMapsPromise;
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------

    async function init(elementId, lat, lng, zoom, apiKey, dotNetRef) {
        const el = document.getElementById(elementId);
        if (!el) return fail(`Map container "${elementId}" was not found in the DOM yet.`);
        dispose();
        dotNetHelper = dotNetRef || null;
        try { await loadGoogleMaps(apiKey); } catch (error) { return fail(error.message || String(error)); }
        return await new Promise((resolve) => {
            let settled = false;
            const done = (result) => { if (settled) return; settled = true; resolve(result); };
            const priorAuthFailure = window.gm_authFailure;
            window.gm_authFailure = () => {
                done(fail('Google Maps rejected this site URL or API key. In Google Cloud Console, add HTTP referrer restrictions for http://localhost:*/* and your deployed domain (for example https://agronomystudio.netlify.app/*), and enable Maps JavaScript API.'));
                if (typeof priorAuthFailure === 'function') priorAuthFailure();
            };
            map = new google.maps.Map(el, {
                center: { lat, lng }, zoom,
                mapTypeId: 'hybrid',
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
            });
            infoWindow = new google.maps.InfoWindow();
            google.maps.event.addListenerOnce(map, 'tilesloaded', () => done({ ok: true }));
            setTimeout(() => done(fail('Google Maps did not finish loading. Confirm the API key, HTTP referrer restrictions, and that Maps JavaScript API is enabled.')), 10000);
        });
    }

    // -------------------------------------------------------------------------
    // Clear helpers
    // -------------------------------------------------------------------------

    function clearPolygons() {
        polygons.forEach(p => p.setMap(null));
        polygons = [];
    }

    function clearMarkers() {
        markerList.forEach(m => m.setMap(null));
        markerList = [];
    }

    function clearHeatmap() {
        if (heatmapLayer) { heatmapLayer.setMap(null); heatmapLayer = null; }
    }

    function clearAll() {
        clearPolygons();
        clearMarkers();
        clearHeatmap();
    }

    // -------------------------------------------------------------------------
    // render — crop-colored block polygons (default view)
    // -------------------------------------------------------------------------

    function render(shapes) {
        if (!map) return;
        clearAll();
        for (const shape of shapes || []) {
            if (!shape.coords || shape.coords.length === 0) continue;
            const paths = shape.coords.map(pair => ({ lat: pair[0], lng: pair[1] }));
            const polygon = new google.maps.Polygon({
                paths,
                strokeColor: shape.color, strokeWeight: 1,
                fillColor: shape.color, fillOpacity: 0.45,
                map,
            });
            polygon.addListener('click', (event) => {
                infoWindow.setContent(shape.popupHtml);
                infoWindow.setPosition(event.latLng);
                infoWindow.open(map);
                if (dotNetHelper && shape.blockId) {
                    dotNetHelper.invokeMethodAsync('OnBlockClicked', shape.blockId, shape.lat, shape.lng);
                }
            });
            polygons.push(polygon);
        }
    }

    // -------------------------------------------------------------------------
    // renderChoropleth — fill each block by a normalized [0,1] value + ramp
    // -------------------------------------------------------------------------

    /**
     * shapes: [{ coords, blockId, lat, lng, popupHtml, value, cloudMasked }]
     * rampName: 'vegetation' | 'gdd' | 'et' | 'frost' | 'moisture' | 'elevation'
     */
    function renderChoropleth(shapes, rampName) {
        if (!map) return;
        clearAll();
        const stops = RAMPS[rampName] || RAMPS.vegetation;
        for (const shape of shapes || []) {
            if (!shape.coords || shape.coords.length === 0) continue;
            const paths = shape.coords.map(pair => ({ lat: pair[0], lng: pair[1] }));
            const color = shape.cloudMasked ? '#94a3b8' : rampColor(stops, shape.value ?? 0);
            const polygon = new google.maps.Polygon({
                paths,
                strokeColor: '#1e293b', strokeWeight: 1,
                fillColor: color, fillOpacity: shape.cloudMasked ? 0.25 : 0.65,
                map,
            });
            polygon.addListener('click', (event) => {
                infoWindow.setContent(shape.popupHtml);
                infoWindow.setPosition(event.latLng);
                infoWindow.open(map);
                if (dotNetHelper && shape.blockId) {
                    dotNetHelper.invokeMethodAsync('OnBlockClicked', shape.blockId, shape.lat, shape.lng);
                }
            });
            polygons.push(polygon);
        }
    }

    // -------------------------------------------------------------------------
    // renderMarkers — probe pins (soil moisture sensors etc.)
    // -------------------------------------------------------------------------

    /**
     * points: [{ lat, lng, blockId, label, color, popupHtml }]
     */
    function renderMarkers(points) {
        if (!map) return;
        clearMarkers();
        for (const pt of points || []) {
            const marker = new google.maps.Marker({
                position: { lat: pt.lat, lng: pt.lng },
                map,
                title: pt.label || pt.blockId,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: pt.color || '#06b6d4',
                    fillOpacity: 0.9,
                    strokeWeight: 1.5,
                    strokeColor: '#1e293b',
                },
            });
            if (pt.popupHtml) {
                marker.addListener('click', () => {
                    infoWindow.setContent(pt.popupHtml);
                    infoWindow.setPosition({ lat: pt.lat, lng: pt.lng });
                    infoWindow.open(map);
                    if (dotNetHelper && pt.blockId) {
                        dotNetHelper.invokeMethodAsync('OnBlockClicked', pt.blockId, pt.lat, pt.lng);
                    }
                });
            }
            markerList.push(marker);
        }
    }

    // -------------------------------------------------------------------------
    // renderHeatmap — elevation / weight-based heatmap (original)
    // -------------------------------------------------------------------------

    function renderHeatmap(points) {
        if (!map) return;
        clearAll();
        const data = (points || []).map(pt => ({
            location: new google.maps.LatLng(pt.lat, pt.lng),
            weight: pt.weight,
        }));
        heatmapLayer = new google.maps.visualization.HeatmapLayer({
            data, map, radius: 30, opacity: 0.75,
        });
    }

    // -------------------------------------------------------------------------
    // Misc
    // -------------------------------------------------------------------------

    function setMapType(type) {
        if (map) map.setMapTypeId(type);
    }

    function highlightBlock(blockId) {
        for (const p of polygons) {
            // polygons don't carry blockId directly; handled via closure in render*
        }
    }

    function dispose() {
        clearAll();
        if (infoWindow) { infoWindow.close(); infoWindow = null; }
        map = null;
        dotNetHelper = null;
    }

    return { init, render, renderChoropleth, renderMarkers, renderHeatmap, setMapType, dispose };
})();

/** Trigger a browser file download from a string payload. */
function agronomyDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}
