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

const deleteFromCloudinary = async (fileUrl) => {
  try {
    if (!fileUrl) throw new Error("File URL is required for deletion");

    // Extract public_id from file URL
    const publicId = fileUrl.split("/").pop().split(".")[0]; // Extract public ID from URL

    // Delete file from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result !== "ok") {
      throw new Error("Failed to delete file from Cloudinary");
    }

    return result; // Return Cloudinary response
  } catch (error) {
    console.error("Cloudinary deletion failed:", error.message);
    throw new Error("Cloudinary deletion failed: " + error.message);
  }
};
 
  export { uploadToCloudinary, deleteFromCloudinary };