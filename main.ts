import fs from 'fs';
import fs_extra from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { NodeHtmlMarkdown } from 'node-html-markdown';

const sleep = (msec: number) => new Promise(resolve => setTimeout(resolve, msec));

async function downloadImage(imgUrl: string, saveName: string) {
  const writer = fs.createWriteStream(saveName)
  const response = await axios({
    url: imgUrl,
    method: 'GET',
    responseType: 'stream',
  })

  response.data.pipe(writer)
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

const create_empty_dir = (dir: string) => {
  if (fs_extra.existsSync(dir))
    fs_extra.removeSync(dir);
  fs_extra.mkdirSync(dir);
}


const delete_keywords = (txt: string): string => {
  const re_keyword = /\<a class="keyword" href="(.+?)"\>(.+?)\<\/a\>/g;
  const images = txt.matchAll(re_keyword);
  for (const match of images) {
    const before = match[0];
    const after = match[2];
    console.log("delete keyword : ", after)
    txt = txt.replaceAll(before, after);
  }
  return txt;
}


const MAX_I = 9999999999;

const analyze = async (fname: string, output_dir: string, img_dir: string) => {
  create_empty_dir(output_dir);
  create_empty_dir(img_dir);
  await sleep(1000);
  const img_regex = /https:\/\/cdn-ak\.f\.st-hatena\.com\/images\/fotolife\/([a-z0-9\/\.]*)/g;

  let i = 0;
  let txt: string = fs.readFileSync(fname).toString();
  const images = txt.matchAll(img_regex);
  txt = delete_keywords(txt);

  for (const match of images) {
    i += 1;
    if (i > MAX_I) break;
    const imgname = match[1].replaceAll("/", "")
    const imgfname = path.join(img_dir, imgname);
    const url = match[0];
    txt = txt.replaceAll(url, `/images/${imgname}`);
    await downloadImage(url, imgfname).catch(e => {
      console.error(e);
    });
    console.log(url);
  }

  const posts = txt.split("-----\n--------\n");
  i = 0;
  console.log("found", posts.length, "post");
  for (let p of posts) {
    i += 1;
    if (i > MAX_I) break;
    try {
      const pp = p.split("-----");
      if (pp.length < 2) continue;
      const infostr = pp[0];
      const body = pp[1].substr(6);
      const info = infostr.matchAll(/^([A-Z]+): (.*)$/gm);
      const infodict: { [key: string]: string } = {}
      for (const i of info) infodict[i[1]] = i[2];
      const md = NodeHtmlMarkdown.translate(body, {}, undefined, undefined);

      const category = infodict["CATEGORY"] && infodict["CATEGORY"].length > 0 ? "[]" : infodict["CATEGORY"];
      let metadata = "---\n";
      metadata += `title: "${infodict["TITLE"]}"\n`;
      metadata += `emoji: ""\n`;
      metadata += `type: ""\n`;
      metadata += `topics: ${category}\n`;
      metadata += `published: ${infodict["STATUS"] === "Publish" ? "true" : "false"}\n`;
      metadata += "---\n\n";

      const output_text = metadata + md;
      const output_fname = infodict["TITLE"].replaceAll(" ", "").replaceAll("/", "") + ".md"
      const output_path = path.join(output_dir, output_fname);
      console.info("writing", output_fname);
      fs.writeFileSync(output_path, output_text);
      await sleep(30);
    } catch (e) {
      console.log(e);
    }
  }
  return;
}

const json_file = "/home/ownr/export.txt";
const main = async () => {
  await analyze(json_file, "articles", "images");
  console.log("End!");
}

main()


