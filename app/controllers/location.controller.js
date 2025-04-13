const db = require("../models");
const Location = db.location;

exports.getList = async (req, res) => {
  try {    
    const { type } = req.query;
    const data = await Location.find({ locationType: type });
    return res.status(200).json({ message: "Successfully Get!", data: data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
}

exports.addItem = async (req, res) => {
  try {
    const { item, type } = req.body;
    const isExist = await Location.findOne({ locationName: item });
    const data = await Location.find({});

    if (isExist) {
      return res.status(200).json({ message: "Already exist", data: data });
    } else {
      const auth = new Location({ locationName: item, locationType: type });
      await auth.save();
      const newData = await Location.find({ locationType: type });
      return res.status(200).json({ message: "Successfully Registered", data: newData });
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
};
