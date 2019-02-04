const pg = require('pg');
const conString = 'postgres://postgres:root@localhost:5432/test';

let client = new pg.Client(conString);
client.connect()

