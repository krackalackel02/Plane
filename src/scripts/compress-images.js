import sharp from "sharp";
import fs from "fs/promises"; // Use the promises-based version of fs
import path from "path";
import { fileURLToPath } from "url";

// ES Module equivalent to get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.join(__dirname, "../../public/images");

const compressImages = async () => {
  console.log(`Scanning for PNGs in: ${inputDir}`);

  try {
    const files = await fs.readdir(inputDir);

    const pngFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".png",
    );

    if (pngFiles.length === 0) {
      console.log("No PNG files found to convert.");
      return;
    }

    console.log(`Found ${pngFiles.length} PNG file(s). Starting conversion...`);

    // Use Promise.all to run conversions in parallel for better performance
    await Promise.all(
      pngFiles.map(async (file) => {
        const inputPath = path.join(inputDir, file);
        const outputFileName = `${path.basename(file, ".png")}.webp`;
        const outputPath = path.join(inputDir, outputFileName);

        try {
          console.log(`- Converting: ${file} -> ${outputFileName}`);
          const info = await sharp(inputPath)
            .webp({ quality: 80 }) // Adjust quality 1-100
            .toFile(outputPath);

          console.log(`  -> Success! Size: ${Math.round(info.size / 1024)} KB`);
        } catch (conversionError) {
          console.error(`  -> Error converting ${file}:`, conversionError);
        }
      }),
    );

    console.log("\nConversion process finished.");
  } catch (err) {
    console.error("Error reading the images directory:", err);
  }
};

// Execute the main function
compressImages();
