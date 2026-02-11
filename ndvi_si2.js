var s2 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED');

var poligonos = ee.FeatureCollection('projects/mi-ee-r/assets/colonia_puntos_raleo')

var geometry = ee.Geometry.Polygon(
        [[[-63.89631256535692, -27.708853914161324],
          [-63.89631256535692, -27.74501809856735],
          [-63.82369980290575, -27.74501809856735],
          [-63.82369980290575, -27.708853914161324]]], null, false);

var filtered = s2
  .filter(ee.Filter.date('2015-01-01', '2026-01-01'))
  .filter(ee.Filter.bounds(geometry));
  
//Cargar Cloud Score+ collection
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

var csPlusBands = csPlus.first().bandNames();//Extraer bandas

//Linkeamos CS+ a cada imagen de la coleccion s2
var filteredS2WithCs = filtered.linkCollection(csPlus, csPlusBands);

//Funcion de máscara Cloud Plus
function maskLowQA(image) {
  var qaBand = 'cs';
  var clearThreshold = 0.5;
  var mask = image.select(qaBand).gte(clearThreshold);
  return image.updateMask(mask);
}

//Aplicamos la función con map a todas las imágenes
var filteredMasked = filteredS2WithCs.map(maskLowQA);
  
//Función para calcular NDVI y que lo añade como una banda
function addNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('ndvi');
  return image.addBands(ndvi);
}

// Aplicar la funciona toda la coleccion con Map
var withNdvi = filteredMasked.map(addNDVI);

// Calculate Salinity Index 2	S2	(B-R)/(B+R)
//Alta correlación para salinidad moderada y alta

//no se usa en ndvi al ser un ratio simple, se mantiene la proporción

function addSI2(image) {
  var si2 = image.expression(
   "(BLUE - RED)/(BLUE + RED)", {
     'BLUE': image.select("B2"),
     'RED': image.select("B4")
   }).rename('SI2');
  return image.addBands(si2);
}

var withSI2 = filteredMasked.map(addSI2);

// Seleccionar bandas NDVI y SI para visualización
var imageNDVI = withNdvi.select('ndvi').mean(); // Solo banda NDVI
var imageSI2 = withSI2.select('SI2').mean(); // Solo banda SAVI

// Parámetros de visualización
var ndviVis = {
  min: 0, // NDVI puede ser negativo
  max: 0.7,  // Máximo teórico
  palette: ["red", "yellow", "green"]
};

var si2Vis = {
  min: -0.5, //
  max: 0.5,
  palette: ['blue', 'white', 'red']
};

Map.centerObject(geometry, 15)
Map.addLayer(imageSI2.clip(geometry), si2Vis,"SI2" )
Map.addLayer(imageNDVI.clip(geometry), ndviVis, "NDVI")
Map.addLayer(poligonos, {color: 'red', fillColor: '00000000'})


//Gráfico de series temporales NDVI
var chartNdvi = ui.Chart.image.series({
  imageCollection: withNdvi.select('ndvi'),
  region: geometry,
  reducer: ee.Reducer.mean(),
  scale: 10
}).setOptions({
      'lineWidth': 1,
      'pointSize': 2,
      'title': 'Serie Temporal NDVI Colonia El Simbolar',
      'interpolateNulls': true,
      'vAxis': {title: 'NDVI'},
      'hAxis': {title: '', format: 'YYYY'}
    });

//Gráfico se series temporales SI2
var chartSI2 = ui.Chart.image.series({
  imageCollection: withSI2.select('SI2'),
  region: geometry,
  reducer: ee.Reducer.mean(),
  scale: 10
}).setOptions({
      'lineWidth': 1,
      'pointSize': 2,
      'title': 'Serie Temporal Salinity Index 2 Colonia El Simbolar',
      'interpolateNulls': true,
      'vAxis': {title: 'SI2'},
      'hAxis': {title: '', format: 'YYYY'}
    });

print(chartNdvi)
print(chartSI2)
