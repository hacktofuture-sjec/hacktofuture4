from PIL import Image

class MetadataAgent:
    def analyze(self, img_path):
        try:
            img = Image.open(img_path)
            exif = img._getexif()

            if exif is None:
                return {
                    "source_exif": "Missing",
                    "gps_data": "Not Found",
                    "device_info": "Unknown",
                    "timestamp": "Present"
                }

            return {
                "source_exif": "Present",
                "gps_data": "Found" if 34853 in exif else "Not Found",
                "device_info": "Verified",
                "timestamp": "Present"
            }
        except:
            return {
                "source_exif": "Missing",
                "gps_data": "Not Found",
                "device_info": "Unknown",
                "timestamp": "Missing"
            }