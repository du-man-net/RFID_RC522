/**
  * vdrMFRC522 Block
  */
//% color="#275C6B" weight=100 icon="\uf2bb" block="vdrMFRC522 RFID"
namespace vdrMFRC522 {
    let Type2=0
    const BlockAdr: number[] = [8, 9, 10]
    let TPrescalerReg = 0x2B
    let TxControlReg = 0x14
    let PICC_READ = 0x30
    let PICC_ANTICOLL = 0x93
    let PCD_RESETPHASE = 0x0F
    let temp = 0
    let val = 0
    let uid: number[] = []

    let returnLen = 0
    let returnData:number[] = []
    let status = 0
    let u = 0
    let ChkSerNum = 0
    let returnBits:any = null
    let recvData : number[]= []
    let PCD_IDLE = 0
    let d=0

    let Status2Reg = 0x08
    let CommandReg = 0x01
    let BitFramingReg = 0x0D
    let MAX_LEN = 16
    let PCD_AUTHENT = 0x0E
    let PCD_TRANSCEIVE = 0x0C
    let PICC_REQIDL = 0x26
    let PICC_AUTHENT1A = 0x60

    let ComIrqReg = 0x04
    let DivIrqReg = 0x05
    let FIFODataReg = 0x09
    let FIFOLevelReg = 0x0A
    let ControlReg = 0x0C
    let Key = [255, 255, 255, 255, 255, 255]

	enum HexDigits {
		//% block="default"
		d0 = 0,
		//% block="1"
		d1,
		//% block="2"
		d2,
		//% block="3"
		d3,
		//% block="4"
		d4,
		//% block="5"
		d5,
		//% block="6"
		d6,
		//% block="7"
		d7,
		//% block="8"
		d8,
		//% block="9"
		d9,
		//% block="10"
		d10,
		//% block="11"
		d11,
		//% block="12"
		d12,
		//% block="13"
		d13,
		//% block="14"
		d14,
		//% block="15"
		d15,
		//% block="16"
		d16
	}


	function MakerBit_convertNumberToHex(value: number, digits: HexDigits) : string {
	  let hex = "";
	  let d: number = digits;
	  if (d == 0) {
		d = 16;
	  }
	  for (let pos = 1; pos <= d; pos++) {
		let remainder = value & 0xF;
		if (remainder < 10) {
		  hex = remainder.toString() + hex;
		} else {
		  hex = String.fromCharCode(55 + remainder) + hex;
		}
		value = value >> 4;
		if (value < 0 && value > -268435456) {
		  value += 268435456;
		}
		if (digits == 0 && value == 0 && (pos % 2) == 0) break;
	  }
	  return hex;
	}

	function RFID_ConvertUIDtoString(uid: number[]) : string {
	  let result = ''
	  uid.forEach(element => {
		result += MakerBit_convertNumberToHex(element, 2);
	  });
	  return result
	}



    function SetBits (reg: number, mask: number) {
        let tmp = SPI_Read(reg)
        SPI_Write(reg, (tmp|mask))
    }

    function SPI_Write (adr: number, val: number) {
        pins.digitalWritePin(DigitalPin.P16, 0)
        pins.spiWrite((adr << 1) & 0x7E)
        pins.spiWrite(val)
        pins.digitalWritePin(DigitalPin.P16, 1)
    }

    function SPI_Read (adr: number) {
        pins.digitalWritePin(DigitalPin.P16, 0)
        pins.spiWrite(((adr<<1)& 0x7E)|0x80)
        val = pins.spiWrite(0)
        pins.digitalWritePin(DigitalPin.P16, 1)
        return val
    }

    function ClearBits (reg: number, mask: number) {
        let tmp = SPI_Read(reg)
        SPI_Write(reg, tmp & (~mask))
    }

    function Request (reqMode: number):[number, any] {
        let Type:number[] = []
        SPI_Write(BitFramingReg, 0x07)
        Type.push(reqMode)
        let [status, returnData, returnBits] = MFRC522_ToCard(PCD_TRANSCEIVE, Type)

        if ((status != 0) || (returnBits != 16)) {
            status = 2
        }

        return [status, returnBits]
    }

    function AntennaON () {
        temp = SPI_Read(TxControlReg)
        if (~(temp & 0x03)) {
            SetBits(TxControlReg, 0x03)
        }
    }

    function AvoidColl ():[number,number[] ] {
        let SerNum = []
        ChkSerNum = 0
        SPI_Write(BitFramingReg, 0)
        SerNum.push(PICC_ANTICOLL)
        SerNum.push(0x20)
        let [status, returnData, returnBits] = MFRC522_ToCard(PCD_TRANSCEIVE, SerNum)

        if (status == 0) {
            if (returnData.length == 5) {
                for (let k = 0; k <= 3; k++) {
                    ChkSerNum = ChkSerNum ^ returnData[k]
                }
                if (ChkSerNum != returnData[4]) {
                    status = 2
                }
            }
            else {
                status = 2
            }
        }
        return [status, returnData]
    }

    function Crypto1Stop () {
        ClearBits(Status2Reg, 0x08)
    }

    function MFRC522_ToCard (command: number, sendData: number[]):[number, number[],number] {
        returnData = []
        returnLen = 0
        status = 2
        let irqEN = 0x00
        let waitIRQ = 0x00
        let lastBits = null
        let n = 0

        if (command == PCD_AUTHENT){
            irqEN = 0x12
            waitIRQ = 0x10
        }

        if (command == PCD_TRANSCEIVE){
            irqEN = 0x77
            waitIRQ = 0x30
        }

        SPI_Write(0x02, irqEN | 0x80)
        ClearBits(ComIrqReg, 0x80)
        SetBits(FIFOLevelReg, 0x80)
        SPI_Write(CommandReg, PCD_IDLE)

        for (let o=0;o<(sendData.length);o++){
            SPI_Write(FIFODataReg, sendData[o])
        }
        SPI_Write(CommandReg, command)

        if (command == PCD_TRANSCEIVE){
            SetBits(BitFramingReg, 0x80)
        }

        let p = 2000
        while (true){
            n = SPI_Read(ComIrqReg)
            p --
            if (~(p != 0 && ~(n & 0x01) && ~(n & waitIRQ))) {
                break
            }
        }
        ClearBits(BitFramingReg, 0x80)

        if (p != 0){
            if ((SPI_Read(0x06) & 0x1B) == 0x00){
                status = 0
                    if (n & irqEN & 0x01){
                    status = 1
                }
                if (command == PCD_TRANSCEIVE){
                    n = SPI_Read(FIFOLevelReg)
                    lastBits = SPI_Read(ControlReg) & 0x07
                    if (lastBits != 0){
                        returnLen = (n -1)*8+lastBits
                    }
                    else{
                        returnLen = n * 8
                    }
                    if (n == 0){
                        n = 1
                    }
                    if (n > MAX_LEN){
                        n = MAX_LEN
                    }
                    for (let q=0;q<n;q++){
                        returnData.push(SPI_Read(FIFODataReg))
                    }
                }
            }
            else{
                status = 2
            }
        }

        return [status, returnData, returnLen]
    }

    function TagSelect (SerNum: number[]) {
        let buff: number[] = []
        buff.push(0x93)
        buff.push(0x70)
        for (let r=0;r<5;r++){
            buff.push(SerNum[r])
        }

        let pOut = CRC_Calculation(buff)
        buff.push(pOut[0])
        buff.push(pOut[1])
        let [status, returnData, returnLen] = MFRC522_ToCard(PCD_TRANSCEIVE, buff)
        if ((status == 0) && (returnLen == 0x18)){
            return returnData[0]
        }
        else{
            return 0
        }
    }

    function CRC_Calculation (DataIn: number[]) {
        ClearBits(DivIrqReg, 0x04)
        SetBits(FIFOLevelReg, 0x80)
        for ( let s=0;s<(DataIn.length);s++){
            SPI_Write(FIFODataReg, DataIn[s])
        }
        SPI_Write(CommandReg, 0x03)
        let t = 0xFF

        while (true){
            let v = SPI_Read(DivIrqReg)
            t--
            if (!(t != 0 && !(v & 0x04))){
                break
            }
        }

        let DataOut: number[] = []
        DataOut.push(SPI_Read(0x22))
        DataOut.push(SPI_Read(0x21))
        return DataOut
    }

    function getIDNum(uid: number[]){
        let a= 0

        for (let e=0;e<5;e++){
            a = a*256+uid[e]
        }
        return a
    }

    function readID() {
        [status, Type2] = Request(PICC_REQIDL)

        if (status != 0) {
            return null
        }
        [status, uid] = AvoidColl()

        if (status != 0) {
            return null
        }

        //return getIDNum(uid)
		return RFID_ConvertUIDtoString(uid)
    }

    /*
     * Initial setup
     */
    //% block="Initialize MFRC522 Module"
    //% weight=100
   export function Init() {
       pins.spiPins(DigitalPin.P15, DigitalPin.P14, DigitalPin.P13)
       pins.spiFormat(8, 0)
       pins.digitalWritePin(DigitalPin.P16, 1)

       // reset module
       SPI_Write(CommandReg, PCD_RESETPHASE)

       SPI_Write(0x2A, 0x8D)
       SPI_Write(0x2B, 0x3E)
       SPI_Write(0x2D, 30)
       SPI_Write(0x2E, 0)
       SPI_Write(0x15, 0x40)
       SPI_Write(0x11, 0x3D)
       AntennaON()
   }

   /*
    * Function to read ID from card
    */
   //% block="Read ID"
   //% weight=95
   export function getID() {
       let id = readID()
       while (!(id)) {
           id = readID()
           if (id!=undefined){
               return id
           }
       }
       return id
   }

  /*
   * TUrn off antenna
   */
  //% block="Turn off antenna"
  //% text
  //% weight=80
  export function AntennaOff () {
      ClearBits(TxControlReg, 0x03)
  }

}