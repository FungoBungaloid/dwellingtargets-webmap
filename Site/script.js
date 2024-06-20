const map = L.map('map').setView([-37.8136, 144.9631], 10);

// Add AGOL aerial basemap with modified properties using CSS filter
const agolAerial = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri & the GIS User Community'
}).addTo(map);

agolAerial.getContainer().style.filter = 'brightness(0.86) saturate(0) contrast(0.73)';

// Add AGOL road labels that appear at high zoom levels
const roadLabels = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    minZoom: 14
}).addTo(map);

const transportationLabels = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    minZoom: 14
}).addTo(map);

// Function to close the about popup
function closeAboutPopup() {
    map.closePopup();
    console.log("About popup closed");
}

// Function to open the about popup
function openAboutPopup() {
    console.log("About button clicked");
    const aboutContent = `
        <div style="max-width: 300px;">
            <p>This is a quick and dirty visualisation of how councils are tracking in relation to the 2051 housing targets released by the Victorian Government in June 2024.</p>
            <p>2051 housing target data from <a href="https://engage.vic.gov.au/project/shape-our-victoria/page/housing-targets-2051" target="_blank">here</a>.</p>
            <p>Historical dwelling approval data, from 2014-2024, is from the ABS (using NDA's as a measure of new dwelling construction [yes I know that's not a perfect way of measuring new construction]).</p>
            <p>Not associated with the Victorian Government or any Local Government.</p>
            <button onclick="closeAboutPopup()">Back to the map</button>
        </div>
    `;
    const aboutPopup = L.popup({ closeOnClick: false })
        .setLatLng(map.getCenter())
        .setContent(aboutContent)
        .openOn(map);
}

// Add about button
const aboutButton = L.control({ position: 'topright' });
aboutButton.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    div.innerHTML = '<a href="#" id="about-button" style="color: white; background-color: black; font-size: 16px; font-weight: bold; display: block; padding: 5px; text-align: center; width: auto;">About</a>';
    div.style.cursor = 'pointer';
    div.onclick = openAboutPopup;
    return div;
};
aboutButton.addTo(map);

// Function to round MultiNeed values to a specific number of decimal places
function roundTo(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

// Function to get category text
function getCategoryText(cat) {
    switch(cat) {
        case 1: return "doing great, and are likely to meet their";
        case 2: return "on track to achieve their";
        case 3: return "tracking a bit below their";
        case 4: return "well below their";
        case 5: return "a very long way from their";
        default: return "";
    }
}

// Load geojson data and process
fetch('DataWebMerc.geojson')
    .then(response => response.json())
    .then(data => {
        console.log('GeoJSON data loaded:', data);

        // Set up color scale
        const breaks = [0, 1.0642, 1.1628, 1.3778, 1.5574, 1.6431, 1.8035, 2.1022, 2.4018, 10];
        const colorScale = d3.scaleThreshold()
            .domain(breaks)
            .range(d3.schemeRdBu[9].reverse());

        // Function to get color based on MultiNeed value
        function getColor(value) {
            const color = colorScale(value);
            console.log(`Value: ${value}, Color: ${color}`);
            return color;
        }

        // Apply styles to each feature
        function styleFeature(feature) {
            const rawMultiNeed = parseFloat(feature.properties.MultiNeed);
            const multiNeed = roundTo(rawMultiNeed, 3);
            const fillColor = getColor(multiNeed);

            return {
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.35,
                fillColor: fillColor,
                interactive: true
            };
        }

        // Add geojson layer to map
        L.geoJson(data, {
            style: styleFeature,
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: e => {
                        const shortfall = (feature.properties.Shortfall * 100).toFixed(0);
                        const trackingText = feature.properties.Shortfall >= 0 
                            ? `Tracking ${shortfall}% above 2051 target`
                            : `Tracking ${shortfall}% below 2051 target`;
                        const popupContent = `
                            <div class="popup-header">${feature.properties.LGA}</div>
                            <div class="centered-text">${trackingText}</div>
                        `;
                        layer.bindPopup(popupContent, { className: 'custom-popup', autoPan: false }).openPopup();
                    },
                    click: e => {
                        const popupContent = `
                            <div class="popup-header">${feature.properties.LGA}</div>
                            <p>Current dwellings: <span class="dynamic-attribute">${feature.properties.Curr.toLocaleString()}</span></p>
                            <p>2051 target: <span class="dynamic-attribute">${(feature.properties.Curr + feature.properties.Add).toLocaleString()}</span></p>
                            <p>The 2051 target calls for an additional <span class="dynamic-attribute">${Math.round(feature.properties.Add).toLocaleString()}</span> dwellings, a <span class="dynamic-attribute">${(feature.properties.PcInc * 100).toFixed(0)}%</span> increase, or <span class="dynamic-attribute">${Math.round(feature.properties.ReqYearly).toLocaleString()}</span> dwellings every year until the end of 2051.</p>
                            <p>Based on the last 10 years of dwelling construction in ${feature.properties.LGA}, <span class="dynamic-attribute">${Math.round(feature.properties.HistYearly).toLocaleString()}</span> per year were constructed, so the 2051 target requires new dwellings to be built at <span class="dynamic-attribute">${feature.properties.MultiNeed.toFixed(1)}<span style="color: red;">x</span></span> the historical rate.</p>
                            <p>So ${feature.properties.LGA} is <span class="dynamic-attribute">${getCategoryText(feature.properties.Cat)}</span> 2051 target.</p>
                        `;
                        layer.bindPopup(popupContent, { className: 'custom-popup' }).openPopup();
                    }
                });
            }
        }).addTo(map);
    })
    .catch(error => console.error('Error loading GeoJSON data:', error));
