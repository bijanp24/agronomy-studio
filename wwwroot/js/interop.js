window.agronomyMap = (function () {
    let map = null;
    let polygons = [];
    let heatmapLayer = null;
    let infoWindow = null;
    let dotNetHelper = null;

    function loadGoogleMaps(apiKey) {
        if (window._googleMapsPromise) return window._googleMapsPromise;

        window._googleMapsPromise = new Promise((resolve) => {
            if (window.google && window.google.maps) {
                resolve();
                return;
            }
            window._initGoogleMaps = resolve;
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization&callback=_initGoogleMaps`;
            script.async = true;
            document.head.appendChild(script);
        });

        return window._googleMapsPromise;
    }

    async function init(elementId, lat, lng, zoom, apiKey, dotNetRef) {
        const el = document.getElementById(elementId);
        if (!el) return;

        dispose();

        dotNetHelper = dotNetRef || null;

        await loadGoogleMaps(apiKey);

        map = new google.maps.Map(el, {
            center: { lat, lng },
            zoom,
            mapTypeId: 'hybrid',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
        });

        infoWindow = new google.maps.InfoWindow();
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
