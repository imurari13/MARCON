import mongoose,{Schema,type Document}from"mongoose";
export interface IShift extends Document{name:string;startTime:string;endTime:string;weeklyOff:number[];isActive:boolean}
const schema=new Schema<IShift>({name:{type:String,required:true,trim:true,unique:true},startTime:{type:String,required:true},endTime:{type:String,required:true},weeklyOff:{type:[Number],default:[0]},isActive:{type:Boolean,default:true}},{timestamps:true});
export default mongoose.model<IShift>("Shift",schema);
