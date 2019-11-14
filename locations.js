'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

const client = new pg.Client(process.env.DATABASE_URL);

let location = {};

location.getLocation = function(request, response) {
  try{
    console.log('we live!');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;
    let SQL = `SELECT * FROM locations WHERE search_query = '${request.query.data}'`;
    client.query(SQL)
      .then(result => {
        if(result.rows[0]){
          response.status(200).send(result.rows[0]);
          console.log('found it!');
        } else{
          superagent.get(url)
            .then( data => {
              console.log('did not find it');
              const geoData = data.body;
              const location = (new Location(request.query.data, geoData));
              let locationsArr = [location.search_query,location.formatted_query,location.latitude,location.longitude];
              SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1,$2,$3,$4)`;
              client.query(SQL,locationsArr);
              response.status(200).send(location);
            });
        }
      });
  }
  catch(error){
    //some function or error message
    errorHandler('So sorry, something went wrong', request, response);
  }
};

function errorHandler (error, request, response) {
  response.status(500).send(error);
}

module.exports = location;
