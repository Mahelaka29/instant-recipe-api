import express from "express";
import axios from "axios";
import path from "path";
import env from "dotenv";
import { fileURLToPath } from 'url';
import passport from "passport";
import session from "express-session";
import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import authRoutes from "./routes/auth.js";
import db from "./db.js";


const app = express();
const PORT = process.env.PORT || 3000;
env.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//SESSION
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);


//middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(authRoutes);


app.use(passport.initialize());
app.use(passport.session());


app.get("/", (req, res) =>{

  console.log("User object:", req.user);
    const loggedOut = req.query.loggedout === "true";
    res.render("index.ejs", {
      user: req.user,
      loggedOut,
      errorMessage: req.query.errorMessage,
    });
})

app.get("/search", (req, res) => {
  res.render("index.ejs", {
    errorMessage: null,
    user: req.user,
    loggedOut: req.query.loggedout === "true",
  });
});

app.post("/search", async (req, res) =>{

    const query = req.body.food;
    const apiKey = process.env.API_KEY;

    try{
        const searchRes = await axios.get(
          `https://api.spoonacular.com/recipes/complexSearch`,
          {
            params: {
              query,
              number: 8,
              apiKey,
              minReadyTime: 1,
              maxReadyTime: 15
            },
          }
        );

          const recipeList  = searchRes.data.results;
          console.log(recipeList.instructions);

          if (recipeList.length === 0) {
            return res.render("index.ejs", {
              errorMessage: `Can't find recipe for "${query}"`,
              user: req.user,
              loggedOut: req.query.loggedout === "true",
            });
          }

           // to get detailed info for each recipe
            const detailPromises = recipeList.map(recipe =>
                axios.get(`https://api.spoonacular.com/recipes/${recipe.id}/information`, {
                params: { apiKey }
            })
            );

            const detailResponses = await Promise.all(detailPromises);

            const fullRecipes = detailResponses.map((res) => {
              const recipe = res.data;

              let steps = [];

              if (
                Array.isArray(recipe.analyzedInstructions) &&
                recipe.analyzedInstructions.length > 0 &&
                Array.isArray(recipe.analyzedInstructions[0].steps)
              ) {
                steps = recipe.analyzedInstructions[0].steps;
              }

              return {
                id: recipe.id,
                title: recipe.title,
                image: recipe.image,
                readyInMinutes: recipe.readyInMinutes,
                steps: steps
              };
            });

            res.render("result.ejs", { recipes: fullRecipes, userSearchFor : query, user: req.user });
    }
    catch(error){
      console.error("Error in /search route:", error.message);
        res.render("index.ejs", { errorMessage: "Something went wrong!", user: req.user, loggedOut: req.query.loggedout === "true" });
    }
    
});

//one recipe in a full page with cooking-instructiton
app.get("/recipe/:id", async (req, res) => {
  const recipeId = req.params.id;
  const apiKey = process.env.API_KEY;

  try {
    const response = await axios.get(
      `https://api.spoonacular.com/recipes/${recipeId}/information`,
      {
        params: { apiKey },
      }
    );

    const recipe = response.data;

    const steps = recipe.analyzedInstructions?.[0]?.steps || [];

    res.render("instructions.ejs", {
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      readyInMinutes: recipe.readyInMinutes,
      ingredients: recipe.extendedIngredients,
      steps: steps,
      user: req.user
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    console.error("Error fetching recipe instructions:", error.message);
    res.render("index.ejs", { errorMessage: "Something went wrong!", user: req.user, loggedOut: req.query.loggedout === "true" });
  }
});


function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

//to retrieve the favourite recipes
app.get("/favourites", ensureAuth, async (req, res) => {
  const result = await db.query("SELECT * FROM favourites WHERE user_id = $1", [
    req.user.id,
  ]);
  res.render("favourites.ejs", { favourites: result.rows, user: req.user });
});

//to save recipe card to favourite list
app.post("/favourites/:id", ensureAuth, async (req, res) => {
  const { id } = req.params;
  const { title, image, readyInMinutes } = req.body;

  try {
    await db.query(
      "INSERT INTO favourites (user_id, recipe_id, recipe_title, recipe_image, ready_in_minutes) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, id, title, image, readyInMinutes]
    );
    res.redirect("/favourites");
  } catch (err) {
    res.send("Failed to save favourite");
  }
});

//to remove recipe card from favourite list
app.post("/favourites/remove/:id", ensureAuth, async (req, res) => {
  await db.query("DELETE FROM favourites WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.user.id,
  ]);
  res.redirect("/favourites");
});


// register
passport.use("local",
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          email,
        ]);
        if (result.rows.length === 0)
          return done(null, false, { message: "No user found" });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
          return done(null, false, { message: "Incorrect password" });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// show login page
app.get("/login", (req, res) => {
  res.render("login.ejs", { user: req.user });
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login",
  failureFlash: true
}));

app.get("/signup", (req, res) => {
  res.render("signup.ejs", { user: req.user });
});


app.post("/signup", async (req, res) => {
  const { email, password, username } = req.body;

  try {
    // check if user already exists
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.render("signup.ejs", { user: req.user, errorMessage: "User already exists" });
    }

    //hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create new user
    const newUser = await db.query(
      "INSERT INTO users (email, password, username) VALUES ($1, $2, $3) RETURNING *",
      [email, hashedPassword, username]
    );

    // log in the user
    req.login(newUser.rows[0], (err) => {
      if (err) return res.render("signup.ejs", { user: req.user, errorMessage: "Signup failed" });
      res.redirect("/");
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.render("signup.ejs", { user: req.user, errorMessage: "Something went wrong" });
  }
});


//logout
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("connect.sid"); // clear session cookie
      res.redirect("/?loggedout=true");
    });
  });
});



//start Google OAuth
app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));


//google OAuth callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",   //if login fails
    successRedirect: "/",        //if login succeeds
  })
);



//google strategy
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await db.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id]
        );

        if (result.rows.length > 0) return done(null, result.rows[0]);

        // Create new user
        const newUser = await db.query(
          "INSERT INTO users (google_id, email, password, username) VALUES ($1, $2, $3, $4) RETURNING *",
          [
            profile.id,
            profile.emails[0].value,
            "google user",
            profile.displayName,
          ]
        );
        return done(null, newUser.rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  )
);


//Serialize
passport.serializeUser((user, done) => {
  done(null, user.id);
});

//Deserialize
passport.deserializeUser(async (id, done) => {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  done(null, result.rows[0]);
});


app.listen(PORT, () =>{
    console.log(`Server listening on Port ${PORT}`);
})