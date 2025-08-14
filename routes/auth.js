import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import db from "../db.js"; // wrap your PG client in db.js if needed

const router = express.Router();

router.get("/login", (req, res) => res.render("login.ejs", { error: null }));
router.get("/signup", (req, res) => res.render("signup.ejs", { error: null }));

router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await db.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)",
      [username, email, hashedPassword]
    );
    res.redirect("/login");
  } catch (error) {
    res.render("signup.ejs", { error: "Email already exists!" });
  }
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

// Google Auth
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => res.redirect("/")
);

export default router;
