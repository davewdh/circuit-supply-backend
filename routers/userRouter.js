import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { generateToken, isAuth } from '../utils.js';

const userRouter = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailCollation = { locale: 'en', strength: 2 };
const passwordRequirements = 'Use at least 11 characters, including uppercase, lowercase, a number, and a special character.';

const text = value => typeof value === 'string' ? value.trim() : '';
const validEmail = email => email.length <= 254 && emailPattern.test(email);

function passwordError(password) {
    if (typeof password !== 'string' || [...password].length < 11 ||
        !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) ||
        !/[^\p{L}\p{N}\s]/u.test(password)) return passwordRequirements;
    if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must use 72 UTF-8 bytes or fewer.';
    return '';
}

function sessionFor(user) {
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user),
    };
}

userRouter.post('/signin', expressAsyncHandler(async (req, res) => {
    const email = text(req.body?.email);
    const password = req.body?.password;
    if (!validEmail(email) || typeof password !== 'string' || !password || password.length > 4096) {
        return res.status(400).send({ message: 'Enter a valid email address and password.' });
    }
    const user = await User.findOne({ email }).collation(emailCollation);
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).send({ message: 'Email or password is incorrect.' });
    }
    res.send(sessionFor(user));
}));

userRouter.post('/register', expressAsyncHandler(async (req, res) => {
    const name = text(req.body?.name);
    const email = text(req.body?.email).toLowerCase();
    const { password, passwordConfirmation } = req.body || {};
    if (typeof password !== 'string' || password !== passwordConfirmation) {
        return res.status(400).send({ message: 'Passwords do not match.' });
    }
    if (!name || name.length > 100) return res.status(400).send({ message: 'Enter a name of 1 to 100 characters.' });
    if (!validEmail(email)) return res.status(400).send({ message: 'Enter a valid email address.' });
    const issue = passwordError(password);
    if (issue) return res.status(400).send({ message: issue });
    if (await User.findOne({ email }).collation(emailCollation).select('_id')) {
        return res.status(409).send({ message: 'An account already uses that email address.' });
    }
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).send(sessionFor(user));
}));

userRouter.get('/:id', isAuth, expressAsyncHandler(async (req, res) => {
    if (req.params.id !== String(req.user._id)) {
        return res.status(404).send({ message: 'User not found.' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).send({ message: 'User not found.' });
    res.send(user);
}));

userRouter.put('/profile', isAuth, expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).send({ message: 'User not found.' });

    const { name, email, password } = req.body || {};
    if (name !== undefined) {
        const candidate = text(name);
        if (!candidate || candidate.length > 100) return res.status(400).send({ message: 'Enter a name of 1 to 100 characters.' });
        user.name = candidate;
    }
    if (email !== undefined) {
        const candidate = text(email).toLowerCase();
        if (!validEmail(candidate)) return res.status(400).send({ message: 'Enter a valid email address.' });
        if (candidate !== user.email && await User.findOne({ email: candidate, _id: { $ne: user._id } })
            .collation(emailCollation).select('_id')) {
            return res.status(409).send({ message: 'An account already uses that email address.' });
        }
        user.email = candidate;
    }
    if (password !== undefined && password !== '') {
        const issue = passwordError(password);
        if (issue) return res.status(400).send({ message: issue });
        user.password = await bcrypt.hash(password, 10);
    }

    res.send(sessionFor(await user.save()));
}));

userRouter.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 11000) return res.status(409).send({ message: 'An account already uses that email address.' });
    console.error('Account request failed:', error.name);
    res.status(500).send({ message: 'We could not complete your request. Try again.' });
});

export default userRouter;
