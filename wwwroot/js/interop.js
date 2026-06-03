window.agronomyMap = (function () {
    let map = null;
    let layerGroup = null;

    function init(elementId, lat, lng, zoom) {
        const el = document.getElementById(elementId);
        if (!el) {
            return;
        }

        if (map) {
            map.remove();
            map = null;
        }

        map = L.map(el, { zoomControl: true }).setView([lat, lng], zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,
        }).addTo(map);

        layerGroup = L.layerGroup().addTo(map);
    }

    function render(shapes) {
        if (!map || !layerGroup) {
            return;
        }

        layerGroup.clearLayers();

        for (const shape of shapes || []) {
            if (!shape.coords || shape.coords.length === 0) {
                continue;
            }

            const latLngs = shape.coords.map(pair => [pair[0], pair[1]]);

            L.polygon(latLngs, {
                color: shape.color,
                weight: 1,
                fillOpacity: 0.45,
            })
                .bindPopup(shape.popupHtml)
                .addTo(layerGroup);
        }
    }

    function dispose() {
        if (map) {
            map.remove();
            map = null;
            layerGroup = null;
        }
    }

    return { init, render, dispose };
})();
