window.agronomyMap = (function () {
    let map = null;
    let polygons = [];
    let heatmapLayer = null;
    let infoWindow = null;
    let dotNetHelper = null;

    function fail(message) {
        return { ok: false, message };
    }

    function loadGoogleMaps(apiKey) {
        if (!apiKey) {
            return Promise.reject(new Error(
                'Google Maps API key is missing. Set GoogleMaps:ApiKey in appsettings.Development.json for local dev, or GOOGLE_MAPS_API_KEY in Netlify / GitHub Actions for production.'
            ));
        }

        if (window._googleMapsPromise) return window._googleMapsPromise;

        window._googleMapsPromise = new Promise((resolve, reject) => {
            if (window.google && window.google.maps) {
                resolve();
                return;
            }

            const callbackName = '_initGoogleMaps';
            let settled = false;

            const finish = (error) => {
                if (settled) return;
                settled = true;
                delete window[callbackName];
                if (error) {
                    window._googleMapsPromise = null;
                    reject(error);
                    return;
                }
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

    async function init(elementId, lat, lng, zoom, apiKey, dotNetRef) {
        const el = document.getElementById(elementId);
        if (!el) {
            return fail(`Map container "${elementId}" was not found in the DOM yet.`);
        }

        dispose();
        dotNetHelper = dotNetRef || null;

        try {
            await loadGoogleMaps(apiKey);
        } catch (error) {
            return fail(error.message || String(error));
        }

        return await new Promise((resolve) => {
            let settled = false;
            const done = (result) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };

            const priorAuthFailure = window.gm_authFailure;
            window.gm_authFailure = () => {
                done(fail(
                    'Google Maps rejected this site URL or API key. In Google Cloud Console, add HTTP referrer restrictions for http://localhost:*/* and your deployed domain (for example https://agronomystudio.netlify.app/*), and enable Maps JavaScript API.'
                ));
                if (typeof priorAuthFailure === 'function') priorAuthFailure();
            };

            map = new google.maps.Map(el, {
                center: { lat, lng },
                zoom,
                mapTypeId: 'hybrid',
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
            });

            infoWindow = new google.maps.InfoWindow();
            google.maps.event.addListenerOnce(map, 'tilesloaded', () => done({ ok: true }));
            setTimeout(() => {
                done(fail(
                    'Google Maps did not finish loading. Confirm the API key, HTTP referrer restrictions, and that Maps JavaScript API is enabled.'
                ));
            }, 10000);
        });
    }

    function render(shapes) {
        if (!map) return;

        polygons.forEach(p => p.setMap(null));
        polygons = [];

        if (heatmapLayer) {
            heatmapLayer.setMap(null);
            heatmapLayer = null;
        }

        for (const shape of shapes || []) {
            if (!shape.coords || shape.coords.length === 0) continue;

            const paths = shape.coords.map(pair => ({ lat: pair[0], lng: pair[1] }));

            const polygon = new google.maps.Polygon({
                paths,
                strokeColor: shape.color,
                strokeWeight: 1,
                fillColor: shape.color,
                fillOpacity: 0.45,
                map,
            });

            polygon.addListener('click', (event) => {
                infoWindow.setContent(shape.popupHtml);
                infoWindow.setPosition(event.latLng);
                infoWindow.open(map);

                if (dotNetHelper && shape.blockId) {
                    dotNetHelper.invokeMethodAsync(
                        'OnBlockClicked',
                        shape.blockId,
                        shape.lat,
                        shape.lng
                    );
                }
            });

            polygons.push(polygon);
        }
    }

    function renderHeatmap(points) {
        if (!map) return;

        polygons.forEach(p => p.setMap(null));

        if (heatmapLayer) heatmapLayer.setMap(null);

        const data = (points || []).map(pt => ({
            location: new google.maps.LatLng(pt.lat, pt.lng),
            weight: pt.weight,
        }));

        heatmapLayer = new google.maps.visualization.HeatmapLayer({
            data,
            map,
            radius: 30,
            opacity: 0.75,
        });
    }

    function setMapType(type) {
        if (map) map.setMapTypeId(type);
    }

    function dispose() {
        polygons.forEach(p => p.setMap(null));
        polygons = [];

        if (heatmapLayer) {
            heatmapLayer.setMap(null);
            heatmapLayer = null;
        }

        if (infoWindow) {
            infoWindow.close();
            infoWindow = null;
        }

        map = null;
        dotNetHelper = null;
    }

    return { init, render, renderHeatmap, setMapType, dispose };
})();
