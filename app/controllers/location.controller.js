const db = require("../models");
const Location = db.location;

exports.getList = async (req, res) => {
  try {    
    const { type, user_id } = req.query;

    if (type == "Facilities") {
      const data = await Location.find({ locationType: type });
      return res.status(200).json({ message: "Successfully Get!", data: data });
    } else {
      if (user_id <= 0) {
        const data = await Location.find({ locationType: type });
        return res.status(200).json({ message: "Successfully Get!", data: data });
      } else {
        if (type == "Hotel") {
          const data = await Location.find({ 
            locationType: type, 
            userId: { $in: [parseInt(user_id), -1] } 
          });
          return res.status(200).json({ message: "Successfully Get!", data: data });
        } else {
          const data = await Location.find({ 
            locationType: type, 
            userId: { $in: [parseInt(user_id), -2] } 
          });
          return res.status(200).json({ message: "Successfully Get!", data: data });
        }
      }
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
}

exports.addItem = async (req, res) => {
  try {
    const { item, type, user_id } = req.body;

    if (type == "Facilities") {
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
    } else {
      if (user_id > 0) {
        const isExist = await Location.findOne({ locationName: item, userId: user_id });
        const data = await Location.find({});
    
        if (isExist) {
          return res.status(200).json({ message: "Already exist", data: data });
        } else {
          const auth = new Location({ locationName: item, locationType: type, userId: user_id });
          await auth.save();
          if (type == "Hotel") {
            const data = await Location.find({ 
              locationType: type, 
              userId: { $in: [parseInt(user_id), -1] } 
            });
            return res.status(200).json({ message: "Successfully Registered", data: data });
          } else {
            const data = await Location.find({ 
              locationType: type, 
              userId: { $in: [parseInt(user_id), -2] } 
            });
            return res.status(200).json({ message: "Successfully Registered", data: data });
          }
        } 
      } else {
        const isExist = await Location.findOne({ locationName: item });
        const data = await Location.find({});
  
        if (isExist) {
          return res.status(200).json({ message: "Already exist", data: data });
        } else {
          const auth = new Location({ locationName: item, locationType: type, userId: user_id });
          await auth.save();
          const newData = await Location.find({ locationType: type });
          return res.status(200).json({ message: "Successfully Registered", data: newData });
        }
      }
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
};
