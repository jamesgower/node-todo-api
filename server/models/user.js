const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
	email: {
		type: String,
		required: true,
		trim: true,
		minlength: 1,
		unique: true, //do not allow multiple user accounts from one email
		validate: {
			validator: validator.isEmail,
			message: '{VALUE} is not a valid email',
		},
	},
	password: {
		type: String,
		require: true,
		minlength: 8,
	},
	tokens: [
		{
			access: {
				type: String,
				required: true,
			},
			token: {
				type: String,
				required: true,
			},
		},
	],
});

UserSchema.methods.toJSON = function() {
	// overrides toJSON and returns only the relevant data to the user
	const user = this;
	const userObj = user.toObject();
	return _.pick(userObj, ['_id', 'email']);
};

UserSchema.methods.generateAuthToken = function() {
	var user = this; //get user data
	var access = 'auth';
	var token = jwt.sign({ _id: user._id.toHexString(), access }, process.env.JWT_SECRET);

	user.tokens = user.tokens.concat([{ access, token }]);

	return user.save().then(() => {
		return token; //return token if successful
	});
};

UserSchema.methods.removeToken = function(token) {
	var user = this; //bind user to this
	return user.update({ //return so can chain on a .then() call in server.js
		$pull: { //search an array, if found remove it
			tokens: { //check tokens array
				token //if the token in tokens array is the same as the token sent to the function, remove the whole object
			}
		}
	});
};

UserSchema.statics.findByToken = function(token) {
	var User = this;
	var decoded;
	try {
		decoded = jwt.verify(token, process.env.JWT_SECRET);
	} catch (e) {
		return Promise.reject();
	}

	return User.findOne({
		_id: decoded._id,
		'tokens.token': token,
		'tokens.access': 'auth',
	});
};

UserSchema.statics.findByCredentials = function (email, password) {
	var User = this; //bind User to this
	return User.findOne({email}).then(user => {
		if(!user) return Promise.reject(); //if no user reject and it will be caught be catch in /users/login in server.js
		return new Promise((resolve, reject) => {
			const hashedPassword = user.password;
			bcrypt.compare(password, hashedPassword, (err, res) => {
				res ? resolve(user) : reject(err);	//if match, resolve with user else reject with error
			});
		});
	});
};

UserSchema.pre('save', function(next) {
	var user = this;
	if (user.isModified('password')) {
		//check if the password has been modified
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(user.password, salt, (err, hash) => {
				user.password = hash; //set user.password to be the hashed password and not the plain text one
				next(); //continue with operations
			});
		});
	} else {
		next(); //password isn't modified, so just continue with operations
	}
});
//Models let you predefine what types of data can be input, and if they are required or not etc
var User = mongoose.model('User', UserSchema);

module.exports = { User };
