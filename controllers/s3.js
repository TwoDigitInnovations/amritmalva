const fs = require('fs');
const S3 = require('aws-sdk/clients/s3');

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey,
});

// uploads a file to s3
function uploadFile(file, branchId) {
  const fileStream = fs.createReadStream(file.path);

  const uploadParams = {
    Bucket: bucketName,
    Body: fileStream,
    Key: `${branchId}/${file.filename}.${
      file.mimetype.split('/')[1]}`,
  };

  return s3.upload(uploadParams).promise();
}
exports.uploadFile = uploadFile;
