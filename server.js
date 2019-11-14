'use strict';

//load Environment veriable from the .env
require('dotenv').config();

//declare Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

//Our dependencies
//const location = require('./locations.js');

//Application setup
const PORT = process.env.PORT;
const app = express(); //convention, just so that it looks better
app.use(cors());

//Database setup
const client = new pg.Client(process.env.DATABASE_URL);

//Begin API routes
app.get('/location',getLocation);
app.get('/weather',getWeather);
app.get('/trails',getTrails);
app.get('/movies',getMovies);
app.get('/yelp',getBusiness);

//404 if the above api routes are not called
app.get('*', (request, response) => {
  response.status(404).send('No such page');
});

function getLocation(request, response) {
  try{
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
}

function getWeather(request, response){
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
  superagent.get(url)
    .then( data => {
      const weatherSummaries = data.body.daily.data.map(day => {
        return new Weather(day);
      });
      response.status(200).send(weatherSummaries);
    })
    .catch( () => {
      errorHandler('Something went wrong', request, response);
    });
}

function getTrails(request, response){
  const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&key=${process.env.TRAIL_API_KEY}`;
  superagent.get(url)
    .then(dataset =>{
      const trailsData = dataset.body.trails.map(trails =>{
        return new Trail(trails);
      });
      response.status(200).send(trailsData);
    })
    .catch( ()=> {
      errorHandler('Something went wrong', request, response);
    });
}

function getMovies(request,response){
  const movies = request.query.data.search_query;
  const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&query=${movies}`;
  console.log(`url is ${url}`);
  superagent.get(url)
    .then(dataset =>{
      const moviesData = dataset.body.results.map(movie =>{
        return new Movies(movie);
      });
      response.status(200).send(moviesData);
    })
    .catch( ()=> {
      errorHandler('Something went wrong', request, response);
    });
}

function getBusiness(request,response){
  const url = `https://api.yelp.com/v3/businesses/search?term=delis&latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`;
  superagent.get(url).set('Authorization',`Bearer ${process.env.YELP_API_KEY}`)
    .then(dataset =>{
      console.log(`output is ${dataset.body.businesses}`);
      const businessData = dataset.body.businesses.map(business =>{
        return new Business(business);
      });
      response.status(200).send(businessData);
    })
    .catch( ()=> {
      errorHandler('Something went wrong', request, response);
    });
}

//Constructor functions
function Location(city, geoData) {
  this.search_query = city;
  this.formatted_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lng;
}

function Weather(day){
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(4,11);
}

function Trail(traildata){
  this.name = traildata.name;
  this.location = traildata.location;
  this.length = traildata.length;
  this.stars = traildata.stars;
  this.star_votes = traildata.starVotes;
  this.summary = traildata.summary;
  this.trails_url = traildata.url;
  this.conditions = traildata.conditionStatus;
  this.condition_date = traildata.conditionDate.toString().slice(0,10);
  this.condition_time = traildata.conditionDate.toString().slice(11,19);
}

// Movies constructor
function Movies(object) {
  this.title = object.title;
  this.overview = object.overview;
  this.average_votes = object.vote_average;
  this.total_votes = object.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w500${object.poster_path}`;
  this.popularity = object.popularity;
  this.released_on = object.released_date;
}

function errorHandler (error, request, response) {
  response.status(500).send(error);
}

function Business(object) {
  this.name = object.name;
  this.image_url = object.image_url;
  this.price = object.price;
  this.rating = object.rating;
  this.url = object.url;
}

//Ensure that the server is listening for requests
//THIS MUST BE AT THE BOTTOM OF THE FILE

//app.listen(PORT, () => console.log(`The server is up listening on ${PORT}`));
client.connect()
  .then(()=>{
    app.listen(PORT, () => console.log(`The server is up listening on ${PORT}`));
  })
  .catch((error)=>{
    console.log('The SQL server did not make it',error);
  });
