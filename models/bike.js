const mongoose = require('mongoose');

const bikeSchema = new mongoose.Schema({
  model: {
    type: String,
    required: true
  },
  pricePerDay: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  available: { type: Boolean, default: true }
});

const Bike = mongoose.model('Bike', bikeSchema);
module.exports = Bike;
