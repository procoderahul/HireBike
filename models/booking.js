const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bikeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike' },
  startDate: Date,
  endDate: Date,
  totalPrice: Number,
  destination: String,
  status: { type: String, default: 'pending' }, // can be 'pending', 'accepted', 'cancelled'
  returned: { type: Boolean, default: false }  // New field for return status

});



const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
