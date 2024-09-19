const db = require("../models");
const Degree = db.degree;

exports.getList = async (req, res) => {
  try {
    const data = await Degree.find({});
    return res.status(200).json({ message: "Successfully Get!", data: data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
}

exports.addItem = async (req, res) => {
    try {
        let item = req.body.item;
        const isExist = await Degree.findOne({ degreeName: item });
        const data = await Degree.find({});
    
        if (isExist) {
            return res.status(200).json({ message: "Already exist", data: data });
        } else {
            const auth = new Degree({ degreeName: item });
            await auth.save();
            const newData = await Degree.find({});
            return res.status(200).json({ message: "Successfully Registered", data: newData });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};