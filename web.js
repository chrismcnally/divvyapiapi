var request = require('request'),
    express = require('express'),
    cors = require('cors'),
    sphereKnn = require('sphere-knn');
var app = express();
app.use(express.logger());

var stations = {},
    stationsLookup = null;

function availableDocks(station) {
    return station.availableDocks > 0;
}

function availableBikes(station) {
    return station.availableBikes > 0;
}

app.get('/stations/all', cors(), function(req, res) {
    res.send(stations.map(stationToGeoJson));
});
app.get('/stations/nearby', cors(), function(req, res) {
    if (!stationsLookup) {
        res.status(500).send({error: 'No stations available.'});
    }

    if (!(req.query.lat && req.query.lon)) {
        res.status(400).send({error: 'Requires lat/lon query arg.'});
    }

    var stations = stationsLookup(req.query.lat, req.query.lon),
        max_stations = req.query.max_stations || 5,
        prefer = req.query.prefer;

    if (prefer === 'bikes') {
        stations = stations.filter(availableBikes);
    } else if (prefer === 'docks') {
        stations = stations.filter(availableDocks);
    }

    stations = stations.slice(0, max_stations);

    res.send(stations.map(stationToGeoJson));
});

function stationToGeoJson(obj) {
    return {
        "type": "Feature",
        "properties": {
            "id": obj.id,
            "stationName": obj.stationName,
            "availableDocks": obj.availableDocks,
            "availableBikes": obj.availableBikes,
            "statusValue": obj.statusValue
        },
        "geometry": {
            "type": "Point",
            "coordinates": [
                obj.longitude,
                obj.latitude
            ]
        }
    };
}

function minutely() {
    request({
        uri: 'http://www.divvybikes.com/stations/json/',
        json: true
    }, function(err, resp, body) {
        if (err) return;
        stations = body.stationBeanList;
        stationsLookup = new sphereKnn(stations);
        var lastUpdate = Date.parse(body.executionTime + " UTC-05:00"),
            ago = new Date().getTime() - lastUpdate;
        console.log("Successfully knn'd " + stations.length + " stations. Last update was " + ago + " ago");
    });
}

setInterval(minutely, 1000 * 60);
minutely();

var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);
});