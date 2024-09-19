const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const Booking = require('./models/booking');
const Contact = require('./models/Contact');  // Import the Contact model

const app = express();

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/bike-rental', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session Management
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/yourdbname' })
}));

// Models
const User = require('./models/user');

// Routes

// Landing Page Route
app.get('/', (req, res) => {
  const success = req.query.success === 'true'; // Check for the success query parameter
  res.render('index', { success });
});

// User Registration
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { name, email, phone, password, address, gender } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('User already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      address,
      gender
    });

    // Save the user to the database
    await newUser.save();

    // Redirect to login page or another page
    res.redirect('/login');
  } catch (err) {
    console.error(err); // Log error for debugging
    res.status(500).send('Server Error'); // Send a 500 error response
  }
});

// User Login
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user._id;
    res.redirect('/user-home');
  } else {
    res.redirect('/login');
  }
});

// User Home Page
app.get('/user-home', async (req, res) => {
  if (req.session.userId) {
    try {
      // Fetch the user details from the database using the userId stored in the session
      const user = await User.findById(req.session.userId);

      // Pass the user data (including name) to the EJS template
      res.render('user-home', { user });
    } catch (err) {
      console.error(err);
      res.redirect('/login'); // In case of any errors, redirect to login page
    }
  } else {
    // If there's no session, redirect to login
    res.redirect('/login');
  }
});


app.post('/user/cancel-booking/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    // Check if the booking status is 'accepted' and if the start date hasn't arrived
    const now = new Date();
    if (booking.status === 'accepted' && now < new Date(booking.startDate)) {
      booking.status = 'cancelled'; // Update status to 'cancelled'
      await booking.save();
      res.redirect('/user/my-bookings');
    } else {
      res.status(400).send("You cannot cancel this booking after the start date.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while cancelling the booking.");
  }
});


app.get('/user/edit-profile', async (req, res) => {
  const userId = req.session.userId; // Assuming session stores user ID
  const user = await User.findById(userId); // Fetch the user data from MongoDB
  res.render('user/edit-profile', { user });
});

app.post('/user/edit-profile', async (req, res) => {
  const userId = req.session.userId;
  const { name, email, phone, password } = req.body;

  // Update the user information
  await User.findByIdAndUpdate(userId, {
    name,
    email,
    phone,
    password
  });

  res.redirect('/user-home'); // Redirect back to the user home page
});


// Admin Login
app.get('/admin/login', (req, res) => {
  res.render('admin-login');
});

app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@gmail.com' && password === 'admin1911') {
    req.session.adminId = 'admin';
    res.redirect('/admin/admin-home');
  } else {
    res.redirect('/admin/login');
  }
});

// Admin Home Page
app.get('/admin/admin-home', (req, res) => {
  if (req.session.adminId) {
    res.render('admin-home');
  } else {
    res.redirect('/admin/login');
  }
});

const multer = require('multer');
const Bike = require('./models/bike');

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Add Bike Route
app.get('/admin/add-bike', (req, res) => {
  if (req.session.adminId) {
    res.render('admin/add-bike');
  } else {
    res.redirect('/admin/login');
  }
});

app.post('/admin/add-bike', upload.single('image'), async (req, res) => {
  const { model, pricePerDay } = req.body;
  const bike = new Bike({
    model,
    pricePerDay,
    image: req.file.filename
  });
  await bike.save();
  res.redirect('/admin/manage-bikes');
});

app.get('/admin/manage-bikes', async (req, res) => {
  if (req.session.adminId) {
    const bikes = await Bike.find();
    res.render('admin/manage-bikes', { bikes });
  } else {
    res.redirect('/admin/login');
  }
});

app.get('/user/view-bikes', async (req, res) => {
  const bikes = await Bike.find(); // Fetch all available bikes
  res.render('user/view-bikes', { bikes });
});

app.get('/user/book-bike/:id', async (req, res) => {
  const bike = await Bike.findById(req.params.id);
  res.render('user/book-bike', { bike });
});


app.post('/user/book-bike/:bikeId', async (req, res) => {
  try {
    const { startDate, endDate, destination } = req.body;
    
    const bike = await Bike.findById(req.params.bikeId);
    
    const timeDiff = new Date(endDate) - new Date(startDate);
    const days = timeDiff / (1000 * 3600 * 24) +1;
    const totalPrice = days * bike.pricePerDay;
    
    const newBooking = new Booking({
      userId: req.session.userId,
      bikeId: bike._id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalPrice,
      destination,  // Saving the destination
      status: 'pending'
    });

    await newBooking.save();
    res.redirect('/user/my-bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while booking the bike.");
  }
});


app.get('/user/my-bookings', async (req, res) => {
  const bookings = await Booking.find({ userId: req.session.userId }).populate('bikeId');
  res.render('user/my-bookings', { bookings });
});

app.get('/admin/manage-bookings', async (req, res) => {
  try {
    // Fetch all bookings and populate the bike and user details
    const bookings = await Booking.find()
      .populate('bikeId') // Make sure 'bikeId' matches your schema field
      .populate('userId') // Make sure 'userId' matches your schema field
      .exec(); // Use exec() to ensure the query executes and returns a promise

    // Render the admin manage bookings page with the bookings data
    res.render('admin/manage-bookings', { bookings });
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).send('Server Error'); // Send a 500 error response
  }
});

// Route to manage users
app.get('/admin/manage-users', async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find({});  // Assuming you have a User model
    res.render('admin/manage-users', { users });
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving users.");
  }
});


app.post('/admin/manage-bookings/accept/:id', async (req, res) => {
  const bookingId = req.params.id;
  await Booking.findByIdAndUpdate(bookingId, { status: 'accepted' });
  res.redirect('/admin/manage-bookings');
});

app.post('/admin/manage-bookings/reject/:id', async (req, res) => {
  const bookingId = req.params.id;
  await Booking.findByIdAndUpdate(bookingId, { status: 'rejected' });
  res.redirect('/admin/manage-bookings');
});

app.get('/admin/edit-bike/:id', async (req, res) => {
  const bike = await Bike.findById(req.params.id);
  res.render('admin/edit-bike', { bike });
});

app.post('/admin/edit-bike/:id', upload.single('image'), async (req, res) => {
  const { model, pricePerDay } = req.body;
  const bike = await Bike.findById(req.params.id);

  // Update bike details
  bike.model = model;
  bike.pricePerDay = pricePerDay;

  // Update image if new one is uploaded
  if (req.file) {
    bike.image = req.file.filename;
  }

  await bike.save();
  res.redirect('/admin/manage-bikes');
});



app.post('/admin/toggle-availability/:id', async (req, res) => {
  const bike = await Bike.findById(req.params.id);
  bike.available = !bike.available; // Toggle the availability
  await bike.save();
  res.redirect('/admin/manage-bikes');
});

app.post('/admin/manage-bookings/mark-returned/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    // Only allow marking as returned if the booking is 'accepted'
    if (booking.status === 'accepted') {
      const returnedStatus = req.query.returned === 'true'; // Get return status from query

      // Update the 'returned' status of the booking
      booking.returned = returnedStatus;
      await booking.save();
    }

    res.redirect('/admin/manage-bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while updating the return status.");
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Failed to log out.');
    }
    res.redirect('/');
  });
});


// Route to display contact submissions in the admin panel
app.get('/admin/manage-contacts', (req, res) => {
  Contact.find()
    .then(contacts => {
      res.render('admin/manage-contacts', { contacts });
    })
    .catch(err => {
      console.error('Error fetching contacts:', err);
      res.redirect('/admin'); // Redirect to admin home if there's an error
    });
});


app.post('/submit-contact', (req, res) => {
  const { fullName, email, phone, age, gender, message } = req.body;

  const newContact = new Contact({
    fullName,
    email,
    phone,
    age,
    gender,
    message
  });

  // Save the contact to MongoDB
  newContact.save()
    .then(() => {
      // Redirect back to the index page with a success flag
      res.redirect('/?success=true');
    })
    .catch(err => {
      console.error('Error saving contact form data:', err);
      res.redirect('/?success=false');
    });
});


// Start Server
app.listen(3000, () => console.log('Server started on port 3000'));
