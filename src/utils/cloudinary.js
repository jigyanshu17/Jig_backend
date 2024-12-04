import { v2 as cloudinary } from "cloudinary";
import fs from "fs";


 cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET, 
 });

 const uploadToCloudinary = async (localFilePath) => {
     try {
       if(!localFilePath) return null;
     // Basic upload
     const result = await cloudinary.uploader.upload(localFilePath, {
    //    folder: options.folder || "uploads", // Optional: specify a folder
    //    public_id: options.publicId, // Optional: custom public ID
       resource_type: "auto", // auto-detect resource type
       
     });

       //  console.log("Upload successful:", result.url);
       fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got successful  
     return result;
   } catch (error) {
     fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
     return null;
   }
};
 
  export { uploadToCloudinary };