import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  //get email, username, fullname, password from user
  const { username, email, fullname, password } = req.body;

  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Fields cannot be empty");
  }
  //check if inputs are provided
  //if not return error
  //check if data already exists

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  //tony12
  //check if password is strong
  const hasUpperCase = password
    .split("")
    .some((pass) => pass.toUpperCase() && pass !== pass.toLowerCase());

    const specialChar = "@!#$%^&*()_+)";
  const hasSpecialChar = password
    .split("")
    .some((char) => specialChar.includes(char));

    const numbers = "1234567890";
  const hasNumbers = password
    .split("")
    .some((char) => numbers.includes(char));

  if (!(password.length >= 7 && hasUpperCase && hasSpecialChar && hasNumbers)) {
    throw new ApiError(401, "Password is not strong enough.Password should include Uppercase, Special Character and Numbers");
  }

  //throw error if exists
  //check for images, check for avatar

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
coverImageLocalPath = req.files.coverImage[0].path;
  }
  


  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar File is required!");
  }
  //upload to cloudinary

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar File is required!");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  //create user object - create in db
  //remove password and refreshToken response
  //check for user ceation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong when registering user!");
  }
  //return res

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered succesfully!"));
});

export { registerUser };
