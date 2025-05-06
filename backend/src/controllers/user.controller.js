import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    console.log(user.email)
    const accessToken =  user.generateAccessToken();
    const refreshToken =  user.generateRefreshToken();
    console.log(accessToken)
    console.log(refreshToken)

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token!"
    );
  }
};

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
  const hasNumbers = password.split("").some((char) => numbers.includes(char));

  if (!(password.length >= 7 && hasUpperCase && hasSpecialChar && hasNumbers)) {
    throw new ApiError(
      401,
      "Password is not strong enough.Password should include Uppercase, Special Character and Numbers"
    );
  }

  //throw error if exists
  //check for images, check for avatar

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
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

const loginUser = asyncHandler(async (req, res) => {
  //get user inputs from req.body
  //check if email and password not empty
  //check for email and password match in database
  //return response
  const { email, username, password } = req.body;
  if (!(email?.trim() || username?.trim())) {
    throw new ApiError(400, "Username or email required!");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist!");
  }
  console.log(user); //check for isPasswordCorrect
  const passwordValid = await user.isPasswordCorrect(password);

  console.log(passwordValid); // check for return value of passwordvalid

  if (!passwordValid) {
    throw new ApiError(401, "Password does not match!");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        201,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully!"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  console.log(req.cookies)
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: "" }
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully!"))
});

const refreshAccessToken = asyncHandler(async(req,res)=>{
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401, "Unauthorised request!")
  }
   

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  
    if(!decodedToken){
      throw new ApiError(401, "Unauthorised request!");
    }
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiError(401, "Invalid RefreshToken!")
    }
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "Refresh Token is expired or used");
    }
  
    const options={
      httpOnly:true
    }
  
    const {accessToken, newRefreshToken} = await user.generateAccessAndRefreshToken(user._Id)
  
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("newRefreshToken", newRefreshToken, options)
      .json(new ApiResponse(200,{accessToken, refreshToken: newRefreshToken}, "Access token refreshed!"));
  } catch (error) {
    throw new ApiError(401, error?.message || "Something went Wrong! Couldn't refresh Token")
  }
})


export { registerUser, loginUser, logoutUser, refreshAccessToken };
