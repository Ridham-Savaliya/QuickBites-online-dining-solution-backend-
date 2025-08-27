import mongoose from "mongoose";
import foodModel from "../models/FoodModel.js";
import { v2 as cloudinary } from "cloudinary";
import restaurantModel from "../models/restaurantModel.js";

const addFood = async (req, res) => {
  try {
    const {
      name,
      oldprice,
      newprice,
      category,
      subCategory,
      veg,
      desc,
      sellerId,
    } = req.body;
    const imageFile = req.file;

    // Checking missing details
    if (!name || !newprice || !veg || !desc || !category) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required details" });
    }

    // Validate price (new price must be less than old price)
    if (newprice >= oldprice) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pricing: New price should always be less than old price.",
      });
    }

    // Upload image to Cloudinary
    const uploadImage = await cloudinary.uploader.upload(imageFile.path, {
      resource_type: "image",
    });
    const imageUrl = uploadImage.secure_url;

    // Find restaurant by sellerId
    const restoData = await restaurantModel.findOne({ sellerId });
    if (!restoData) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    // Add data in database
    const foodData = {
      sellerId,
      name,
      restoname: restoData.name,
      oldprice,
      newprice,
      veg,
      desc,
      category,
      subCategory,
      image: imageUrl,
    };

    const newFood = new foodModel(foodData);
    await newFood.save();

    res
      .status(201)
      .json({ success: true, message: "Food uploaded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Something went wrong, please try again",
    });
  }
};

// display all foods in frontend
const allFoods = async (req, res) => {
  try {
    const foods = await foodModel.find({});
    res.json({ success: true, foods, message: "Foods fetched" });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Foods not fetched" });
  }
};

const getFilteredFoods = async (req, res) => {
  try {
    const { category, subCategory } = req.body;
    console.log(category, subCategory);
    const filteredFoods = await foodModel.find({ category, subCategory });
    res.json({ success: true, filteredFoods, message: "Foods fetched" });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Foods not fetched" });
  }
};

export { addFood, allFoods, getFilteredFoods };
